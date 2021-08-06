const exec = require('child_process').execSync;

// Input
const pmAuth = '30331bc7fba4215abb7724e4b839242bead0db897784012ed8a40db3577955532eac5ca7e7bfe418cdb05d04910ff0e986e1023abd6b6c81d0b485a6b9a953af176cf7033a217359d8c0becbbfa50a67dbef'; // Just visit url/auth/1/token
const pmUrl = 'https://prod-aztrial-ids.c3ids.cloud/'; // url to prod/root tag
const pmTenant = 'c3e';
const presignedUrlScriptPath = 'getPresignedUrl.js'; // Use absolute path

const pathToRepo = process.argv[2] || '.'; // path to where packages are listed
const getMapCmd = `c3 -T ${pmAuth} -t ${pmTenant}:${'prod'} ${presignedUrlScriptPath} -e ${pmUrl}`;
console.log(getMapCmd)
const presignedUrlMap = JSON.parse(exec(getMapCmd, (error, stdout, stderr) => {return stdout}).toString());

const execCommand = (cmd) => {
   exec(cmd, (error, stdout, stderr) => {
      if (error) {
          console.log(`error: ${error.message}`);
          return;
      }
      if (stderr) {
          console.log(`stderr: ${stderr}`);
          return;
      }
      console.log(`stdout: ${stdout}`);
   });
}

for (var key in presignedUrlMap) {
   const packageName = key.split('$$')[0];
   const sha = key.split('$$')[1];
   const presignedUrl = presignedUrlMap[key];
   console.log(`package: ${packageName}\nsha: ${sha}\nurl: ${presignedUrl}`)
   execCommand(`git checkout ${sha}`);
   const zipCommand = `c3 prov zip -u BA:BA -c ${packageName} -a ${pathToRepo} -D --output ~/temp.zip`;
   console.log(zipCommand)
   execCommand(zipCommand);
   execCommand(`curl -k --upload-file ~/temp.zip '${presignedUrl}'`);
}
