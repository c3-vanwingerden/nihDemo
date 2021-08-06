c3ImportAll();

var spec = {
  sha: 'a7bdcc2bc664c5e0bcdc6adbb5ed3666ff5d2fe5', // git sha for repo
  gitToken: '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', // git auth token for repo
  gitRepo: 'c3-vanwingerden/nihDemo/',
  metadataRepoDir: 'researcherOne', // path from root of source control repo to repository.json
  branch: 'develop', // git branch
};

function genId () {
  return 'manual-' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
}

var git = GitHub.withToken(spec.gitToken);
var createdPackages = [];
var presignedUrlMap = {};

function metadataPackagesFromSrcCtrl(spec) {
  var metadataPackages = MetadataPackage.arry();

  // Get all files/folders in the repository directory
  var gitHubDir = git.directory(spec.gitRepo, spec.metadataRepoDir, spec.sha);

  // For every file/folder, treat it as a metadata package directory and try to create a MetadataPackage
  gitHubDir.forEach(function (gitHubDirItem) {
    try {
      var packageJson = git
        .content(spec.gitRepo, gitHubDirItem.path + '/package.json', spec.sha)
        .readString();
      metadataPackages.push(MetadataPackage.fromJsonString(packageJson));
    } catch (e) {
      // Exception will arise when repository directory file is not a package directory, log error and move on
    }
  }.bind(this));

  return metadataPackages;
}

var repoJson = JSON.parse(git.content(spec.gitRepo, spec.metadataRepoDir + '/repository.json', spec.sha).readString());
var repoBuild = MetadataRepositoryBuild.make({
  id: genId(),
  packageName: repoJson.name,
  branch: spec.branch,
  repository: repoJson.name,
  refSpec: spec.sha,
  semanticVersion: repoJson.version,
  dependencies: repoJson.dependencies,
});
repoBuild = repoBuild.reserveNextBuild();
repoBuild.createArtifact();

metadataPackagesFromSrcCtrl(spec).forEach(function (pkg) {
  var packageInfo = MetadataPackageFields.make({
    name: pkg.name,
    description: pkg.description,
    author: pkg.author,
    dependencies: pkg.dependencies,
  });

  if (!MetadataPackageStore.get(packageInfo.name)) {
    MetadataPackageStore.upsert({
      id: packageInfo.name,
      name: packageInfo.name,
      kind: MetadataPackageStoreKind.C3PM,
      repositoryStore: repoJson.name,
    });
  }

  var metadataPackageBuild = MetadataPackageBuild.upsert({
    id: genId(),
    packageName: packageInfo.name,
    repository: repoBuild.repository,
    branch: repoBuild.branch,
    semanticVersion: repoBuild.semanticVersion,
    refSpec: repoBuild.refSpec,
    packageStore: { id: packageInfo.name },
    packageInfo: packageInfo,
  }).get();
  createdPackages.push(metadataPackageBuild);
});

function createMarketplacePackageForBuild(pkgBuild) {
  MarketplacePackage.resolvePackageDependencies(pkgBuild.dependencyResolutionSpecFor());
  MarketplacePackage.upsert({
      id: genId(),
      build: pkgBuild,
      packageName: pkgBuild.packageName,
      semanticVersion: pkgBuild.semanticVersion,
      compatibleServerVersion: pkgBuild.dependentServerVersionFor(),
      publisher: OrganizationBase.fetch({ filter: 'marketplaceAdmin == "' + MetadataRepositoryStore.get(pkgBuild.get().repository).admin + '"' }).objs[0],
      repoDependencies: MarketplacePackage.flattenPackageDependencies(pkgBuild.dependencyResolutionSpecFor()),
  });
}

_.each(createdPackages, function (pkg) {
  try {
    pkg.get().createArtifact();
    presignedUrlMap[pkg.packageName + '$$' + spec.sha] = pkg.generatePresignedUrl('PUT', '1h');
    createMarketplacePackageForBuild(pkg.get());
  } catch (e) {
    // noop
  }
});

console.log(JSON.stringify(presignedUrlMap));

// server
// MetadataPackageBuild.mergeBatch(MetadataPackageBuild.fetch({ filter: Filter.eq('semanticVersion', '7.21.0+2') }).objs.map(b => b.putField('semanticVersion', '7.21.0+312').putField('dependentServerVersion', '7.21.0+312')))
// MetadataRepositoryBuild.mergeBatch(MetadataRepositoryBuild.fetch({ filter: Filter.eq('semanticVersion', '7.21.0+2') }).objs.map(b => b.putField('semanticVersion', '7.21.0+312')))
// MarketplacePackage.mergeBatch(MarketplacePackage.fetch({ filter: Filter.eq('semanticVersion', '7.21.0+2') }).objs.map(b => b.putField('semanticVersion', '7.21.0+312').putField('compatibleServerVersion', '7.21.0+312')))

// base
// MetadataPackageBuild.mergeBatch(MetadataPackageBuild.fetch({ filter: Filter.eq('semanticVersion', '7.21.0+1') }).objs.map(b => b.putField('semanticVersion', '7.21.0+46').putField('dependentServerVersion', '7.21.0+312')))
// MetadataRepositoryBuild.mergeBatch(MetadataRepositoryBuild.fetch({ filter: Filter.eq('semanticVersion', '7.21.0+1') }).objs.map(b => b.putField('semanticVersion', '7.21.0+46')))
