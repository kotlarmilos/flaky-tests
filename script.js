const { execSync } = require('child_process');
const Utilities = require('./utilities');
const path = require("path");

function startup(){
    if (Utilities.fileExists('report.csv'))
        execSync('rm report.csv');
    execSync('rm -rf projects/*');

    if (Utilities.fileExists('iDFlakies/')){
        execSync('rm -rf iDFlakies/');
    }
    execSync(`git clone https://github.com/idflakies/iDFlakies`);

    // patching iFlakes version on maven repository, 1.1 doesn't exist
    Utilities.writeFile('iDFlakies/pom-modify/modify-project.sh',Utilities.readFile('iDFlakies/pom-modify/modify-project.sh').toString().replace('1.1.0','1.0.2'));
    Utilities.writeFile('iDFlakies/pom-modify/PomFile.java',Utilities.readFile('iDFlakies/pom-modify/PomFile.java').toString().replace('1.1','1.0'));

}

function setup(projectUrl) {
    console.log(`Cloning ${projectUrl}`);
    execSync(`cd projects && git clone ${projectUrl}`);
}

function cleanup(){
    execSync('rm -rf projects/*');
}

function getProjectDetails(project){
    const projectName = project.items[0].Project;
    const projectUrl = project.items[0].URL;
    const lastCheckedCommit = project.items[0]['SHA Detected'];

    return { projectUrl, lastCheckedCommit, projectName };
}

function convertToCSV(projectName, projectUrl, lastCheckedCommit, newFlakyIDTests, category){
    const array = [];
    for (const module of newFlakyIDTests){
        for (const testName of module.deleted){
            array.push({
                'Project': projectName,
                'Project URL': projectUrl,
                'SHA Confirmed': lastCheckedCommit,
                'Module Path': module.moduleName,
                'Fully-Qualified Test Name (packageName.ClassName.methodName)': testName
                ,'Category': category,
                'Confirmation': 'deleted'});
        }

        for (const testName of module.notFlakyAnyMore) {
            array.push({
                'Project': projectName,
                'Project URL': projectUrl,
                'SHA Confirmed': lastCheckedCommit,
                'Module Path': module.moduleName,
                'Fully-Qualified Test Name (packageName.ClassName.methodName)': testName
                , 'Category': category,
                'Confirmation': 'notFlakyAnyMore'
            });
        }

        for (const testName of module.stillFlaky){
            array.push({
                'Project': projectName,
                'Project URL': projectUrl,
                'SHA Confirmed': lastCheckedCommit,
                'Module Path': module.moduleName,
                'Fully-Qualified Test Name (packageName.ClassName.methodName)': testName
                ,'Category': category,
                'Confirmation': 'stillFlaky'});
        }

        for (const testName of module.newlyFound){
            array.push({
                'Project': projectName,
                'Project URL': projectUrl,
                'SHA Confirmed': lastCheckedCommit,
                'Module Path': module.moduleName,
                'Fully-Qualified Test Name (packageName.ClassName.methodName)': testName
                ,'Category': category,
                'Confirmation': 'newlyFound'});
        }
    }
    return array;
}

function checkForUpdates(projectUrl, lastCheckedCommit){
    const latestCommit = execSync(`git ls-remote ${projectUrl} | head -1 | sed "s/HEAD//"`).toString().replace('\t\n','');

    console.log(`Latest commit from master branch is ${latestCommit}`);
    console.log(`Current commit from master branch is ${lastCheckedCommit}`);
    console.log();

    if (lastCheckedCommit ===latestCommit) {
        console.log(`There are no updates on the git repository. There are still ${project.items.length} flaky tests. Skipping this project.`);
        return false;
    }

    return true;
}

function getIDStats(log, projectName){
    const results = [];

    const rePattern = new RegExp(/\nnondexDir(.*)/g);
    let nondexDirectories = log.match(rePattern);
    if (!nondexDirectories || (nondexDirectories && nondexDirectories.length === 0))
        return [];
    nondexDirectories = Array.from(new Set(nondexDirectories.map(x=>x.replace('\nnondexDir=',''))));

    for(const directory of nondexDirectories) {
        const moduleName = path.basename(path.dirname(directory)) === projectName ? '.' : path.basename(path.dirname(directory));
        let failedTests = [];
        let executedTests = [];
        try {
            if (Utilities.fileExists(path.join(directory, 'LATEST'))) {
                const tempDirectories = Utilities.readFile(path.join(directory, 'LATEST')).split('\n').filter(x => x !== '');
                for (const tempDirectory of tempDirectories) {
                    const tempExecutedTests = Utilities.fromDir(path.join(directory, tempDirectory), '.txt');
                    if (tempExecutedTests && tempExecutedTests.length > 0)
                        executedTests = executedTests.concat(tempExecutedTests.filter((item) => executedTests.indexOf(item) < 0 && item !== '').map(x => x.replace('.txt', '')));
                    if (Utilities.fileExists(path.join(directory, tempDirectory, 'failures')))
                        failedTests = failedTests.concat(Utilities.readFile(path.join(directory, tempDirectory, 'failures')).split('\n').filter((item) => failedTests.indexOf(item) < 0 && item !== ''));
                }
            }
        }catch(e){
            console.error(`Error occured for ${projectName}. Details: ${e.message}`);
        }
        results.push({moduleName, executedTests, failedTests});
    }

    return results;
}

function getODStats(log, projectName){
    const results = [];

    const rePattern = new RegExp(/Found (.*) tests, writing list to(.*)/g);
    let iFlakiesDirectories = log.match(rePattern);
    if (!iFlakiesDirectories || (iFlakiesDirectories && iFlakiesDirectories.length === 0))
        return [];
    iFlakiesDirectories = Array.from(new Set(iFlakiesDirectories.map(x=>x.replace(/Found (.*) tests, writing list to /,'').replace(/ (.*)/, ''))));

    for(const filepath of iFlakiesDirectories) {
        const moduleName = path.basename(path.dirname(path.dirname(path.dirname(filepath)))) === projectName ? '.' : path.basename(path.dirname(path.dirname(path.dirname(filepath))));
        let failedTests = [];
        let executedTests = [];

        try{
            if (Utilities.fileExists(filepath)){
                const result = Utilities.readFile(filepath);
                failedTests = result.split('\n').filter((item) => item !== '');
            }

            if (Utilities.fileExists(path.join(path.dirname(path.dirname(filepath)),'original-order'))) {
                const result = Utilities.readFile(path.join(path.dirname(path.dirname(filepath)),'original-order'));
                executedTests = result.split('\n').filter((item) => item !== '');
            }
        }catch(e){
            console.error(`Error occured for ${projectName}. Details: ${e.message}`);
        }
        results.push({moduleName, executedTests, failedTests});
    }

    return results;
}

function compareTests(oldResults, newResults, category){
    for (const module of newResults) {
        const correspondingModule = oldResults.find(x=>x['Module Path'] === module.moduleName);
        let existingFlakyTests = [];
        if (correspondingModule) {
            existingFlakyTests = correspondingModule.items.filter(x=>x.Category.includes(category)).map(x=>x['Fully-Qualified Test Name (packageName.ClassName.methodName)']);
        }

        module.deleted = existingFlakyTests.filter(x=>!module.executedTests.includes(x) && !module.failedTests.includes(x));
        module.notFlakyAnyMore = existingFlakyTests.filter(x=>module.executedTests.includes(x) && !module.failedTests.includes(x));
        module.stillFlaky = existingFlakyTests.filter(x=>module.executedTests.includes(x) && module.failedTests.includes(x));
        module.newlyFound = module.failedTests.filter(x=>!existingFlakyTests.includes(x));

        delete module.executedTests;
        delete module.failedTests;
    }
}

function checkIDTests(projectName) {
    console.log('=================================================================');
    console.log(`             Running NonDex script for ID tests`);
    console.log(`               Project Name: ${projectName}`);
    console.log('=================================================================');
    console.log();

    let results = [];
    const modules = Utilities.getDirectories(`projects/${projectName}`).map(x=>path.join(x,'pom.xml'));
    modules.push(`projects/${projectName}/pom.xml`);
    for (const module of modules){
        if (Utilities.fileExists(module)) {
            let output;
            const modulePath = path.basename(path.dirname(module)) === projectName ? `projects/${projectName}` : `projects/${projectName}/${path.basename(path.dirname(module))}`;
            try {
                console.log(`Runnung ${modulePath} module. This may take up to several hours.`);
                output = execSync(`cd ${modulePath} && mvn edu.illinois:nondex-maven-plugin:1.1.2:nondex`).toString();

            } catch (e) {
                output = e.stdout.toString();
                // console.error(`Error occured for NonDex command, project ${projectName}, and module ${modulePath}. Details: ${e}`);
            }

            // mocking log file
            //output = Utilities.readFile('mockedLogs/NonDexOutput.log');
            console.log(`Analysing results, this may take up to several minutes.`);
            results = results.concat(getIDStats(output, projectName));
        }
    }
    return results;
}

function checkODTests(projectName) {
    console.log('=================================================================');
    console.log(`             Running iDFlakies script for OD tests`);
    console.log(`                 Project Name: ${projectName}`);
    console.log('=================================================================');
    console.log();
    console.log(`This may take up to several hours.`);

    execSync(`bash iDFlakies/pom-modify/modify-project.sh projects/${projectName}/`);

    let results = [];
    const modules = Utilities.getDirectories(`projects/${projectName}`).map(x=>path.join(x,'pom.xml'));
    modules.push(`projects/${projectName}/pom.xml`);
    for (const module of modules){
        if (Utilities.fileExists(module)) {
            let output;
            const modulePath = path.basename(path.dirname(module)) === projectName ? `projects/${projectName}` : `projects/${projectName}/${path.basename(path.dirname(module))}`;
            try {
                console.log(`Runnung ${modulePath} module. This may take up to several hours.`);
                output = execSync(`cd ${modulePath} && mvn testrunner:testplugin -Ddetector.detector_type=random-class-method -Ddt.randomize.rounds=10 -Ddt.detector.original_order.all_must_pass=false`).toString();

            } catch (e) {
                output = e.stdout.toString();
                // console.error(`Error occured for iDFlakies command, project ${projectName}, and module ${modulePath}. Details: ${e}`);
            }

            // mocking log file
            //output = Utilities.readFile('mockedLogs/iDFlakiesOutput.log');
            console.log(`Analysing results, this may take up to several minutes.`);
            results = results.concat(getODStats(output, projectName));
        }
    }
    return results;
}



async function main(){
    const flakyTestsFilePath = 'unfixedFlakyTests/list.csv';
    const projects = Utilities.groupBy('Project', (await Utilities.readCSV(flakyTestsFilePath)).filter(x=>x.URL !== ''));
    let totalTests = 0;

    startup();

    for (const project of projects) {
        const {projectUrl, lastCheckedCommit, projectName} = getProjectDetails(project);

        console.log('*****************************************************************');
        console.log(`          Running scripts for ${projectName} project`);
        console.log(`               Project URL: ${projectUrl}`);
        console.log('*****************************************************************');

        const checkAgain = checkForUpdates(projectUrl, lastCheckedCommit);
        if (checkAgain) {
            setup(projectUrl);
            try {
                const newFlakyIDTests = checkIDTests(projectName);
                const oldFlakyIDTests = Utilities.groupBy('Module Path', project.items);
                compareTests(oldFlakyIDTests, newFlakyIDTests, 'ID');
                const IDArray = convertToCSV(projectName, projectUrl, lastCheckedCommit, newFlakyIDTests, 'ID');
                await Utilities.writeCSV('report.csv', IDArray);
                totalTests += IDArray.length;
            }catch(e){
                console.error(`Error occured for NonDex command and project ${projectName}. Details: ${e}`);
            }
            try {
                const newFlakyODTests = checkODTests(projectName);
                const oldFlakyODTests = Utilities.groupBy('Module Path', project.items);
                compareTests(oldFlakyODTests, newFlakyODTests, 'OD');
                const ODArray = convertToCSV(projectName, projectUrl, lastCheckedCommit, newFlakyODTests, 'OD');
                await Utilities.writeCSV('report.csv', ODArray);
                totalTests += ODArray.length;
            }catch(e){
                console.error(`Error occured for iDFlakies command and project ${projectName}. Details: ${e}`);
            }

            cleanup();
            console.log(`Detected changes in ${totalTests} tests so far...`);
        }
    }
    console.log();
    console.log(`Excel report is available at report.csv`);
}

main();