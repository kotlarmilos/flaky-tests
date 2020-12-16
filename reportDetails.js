const { execSync } = require('child_process');
const Utilities = require('./utilities');
const path = require("path");

function getProjectDetails(project){
    const projectName = project.items[0].Project;
    const projectUrl = project.items[0]['Project URL'];
    const lastCheckedCommit = project.items[0]['SHA Detected'];

    return { projectUrl, lastCheckedCommit, projectName };
}

function startup(){
    if (Utilities.fileExists('reportDetails.csv'))
        execSync('rm reportDetails.csv');
    execSync('rm -rf projects/*');
}

function setup(projectUrl) {
    console.log(`Cloning ${projectUrl}`);
    execSync(`cd projects && git clone ${projectUrl}`);
}

function cleanup(){
    execSync('rm -rf projects/*');
}

function getFileInfo(projectName, testFilePath){
    const result = {};

    let log; let rePattern;
    const commitPattern = new RegExp(/commit (.*)\n/g);
    const datePattern = new RegExp(/Date: (.*)\n/g);

    try{
        log = execSync(`cd projects/${projectName} && git log --diff-filter=D -- ${testFilePath}`).toString();
        result.deletedCommit = log.match(commitPattern)[0].replace('commit ','').replace('\n','');
        result.deletedDate = log.match(datePattern)[0].replace('Date:   ','').replace('\n','');
    }catch(e){}

    try{
        log = execSync(`cd projects/${projectName} && git log --diff-filter=M -- ${testFilePath}`).toString();
        result.modifiedCommit = log.match(commitPattern)[0].replace('commit ','').replace('\n','');
        result.modifiedDate = log.match(datePattern)[0].replace('Date:   ','').replace('\n','');
    }catch(e){}

    try{
        log = execSync(`cd projects/${projectName} && git log --diff-filter=A -- ${testFilePath}`).toString();
        result.createdCommit = log.match(commitPattern)[0].replace('commit ','').replace('\n','');
        result.createdDate = log.match(datePattern)[0].replace('Date:   ','').replace('\n','');
    }catch(e){}

    return result;
}

async function main(){
    const reportFilePath = 'report.csv';
    const projects = Utilities.groupBy('Project', (await Utilities.readCSV(reportFilePath)).filter(x=>x.URL !== ''));

    startup();

    for (const project of projects) {
        const {projectUrl, lastCheckedCommit, projectName} = getProjectDetails(project);

        console.log('*****************************************************************');
        console.log(`          Fetching details for ${projectName} project`);
        console.log(`               Project URL: ${projectUrl}`);
        console.log('*****************************************************************');

        const deletedTests = project.items.filter(x=>x.Confirmation==='deleted');
        if (deletedTests.length > 0) {
            setup(projectUrl);
            const result = [];
            const testFilePaths = deletedTests.map(x=>`${path.dirname(path.join(x['Module Path'],'src/test/java', x['Fully-Qualified Test Name (packageName.ClassName.methodName)'].split('.').join('/')))}.java`);
            for (const testFilePath of testFilePaths) {
                const fileDetails = getFileInfo(projectName, testFilePath);
                fileDetails.testFilePath = testFilePath;
                result.push(fileDetails);
            }
            await Utilities.writeDetailsCSV('reportDetails.csv', result);
            cleanup();
        }
    }

    console.log();
}
main();