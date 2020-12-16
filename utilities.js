const csv = require('csv-parser');
const fs = require('fs');
const path = require("path");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

class Utilities {
    static readCSV(path) {
        return new Promise(((resolve, reject) => {
            const results = [];
            fs.createReadStream(path)
                .pipe(csv())
                .on('data', data => results.push(data))
                .on('end', () => {
                    resolve(results);
                })
                .on('error', reject);
        }));
    }

    static async writeCSV(path, data){

        let existingData = [];
        if (Utilities.fileExists(path)){
            existingData = await Utilities.readCSV(path);
        }
        const csvWriter = createCsvWriter({
            path: path,
            header: [
                {id: 'Project', title: 'Project'},
                {id: 'Project URL', title: 'Project URL'},
                {id: 'SHA Confirmed', title: 'SHA Confirmed'},
                {id: 'Module Path', title: 'Module Path'},
                {id: 'Fully-Qualified Test Name (packageName.ClassName.methodName)', title: 'Fully-Qualified Test Name (packageName.ClassName.methodName)'},
                {id: 'Category', title: 'Category'},
                {id: 'Confirmation', title: 'Confirmation'},
            ]
        });

        data = data.concat(existingData);
        await csvWriter.writeRecords(data);
    }

    static async writeDetailsCSV(path, data){

        let existingData = [];
        if (Utilities.fileExists(path)){
            existingData = await Utilities.readCSV(path);
        }
        const csvWriter = createCsvWriter({
            path: path,
            header: [
                {id: 'testFilePath', title: 'testFilePath'},
                {id: 'deletedCommit', title: 'deletedCommit'},
                {id: 'deletedDate', title: 'deletedDate'},
                {id: 'modifiedCommit', title: 'modifiedCommit'},
                {id: 'modifiedDate', title: 'modifiedDate'},
                {id: 'createdCommit', title: 'createdCommit'},
                {id: 'createdDate', title: 'createdDate'},
        ]});

        data = data.concat(existingData);
        await csvWriter.writeRecords(data);
    }

    static readFile(path) {
        return fs.readFileSync(path).toString();
    }


    static writeFile(path, content) {
        fs.writeFileSync(path, content);
    }

    static removeFilePart(dirname){
        return path.parse(dirname).dir;
    };

    static fileExists(path) {
        return fs.existsSync(path);
    }

    static groupBy(key, array) {
        const result = [];
        for (let i = 0; i < array.length; i++) {
            let added = false;
            for (let j = 0; j < result.length; j++) {
                if (result[j][key] === array[i][key]) {
                    result[j].items.push(array[i]);
                    added = true;
                    break;
                }
            }
            if (!added) {
                const entry = {items: []};
                entry[key] = array[i][key];
                entry.items.push(array[i]);
                result.push(entry);
            }
        }
        return result;
    }

    static fromDir(startPath,filter){
        if (!fs.existsSync(startPath)){
            return [];
        }

        let files=fs.readdirSync(startPath);

        const results = [];
        for(let i=0;i<files.length;i++){
            const filename=path.join(startPath,files[i]);
            const stat = fs.lstatSync(filename);
            if (!stat.isDirectory() && filename.indexOf(filter)>=0) {
                results.push(path.basename(filename));
            }
        }

        return results;
    };

    static isDirectory(source){
        return fs.lstatSync(source).isDirectory();
    }

    static getDirectories(source){
        return fs.readdirSync(source).map(name => path.join(source, name)).filter(x=>Utilities.isDirectory(x));
    }



}

module.exports = Utilities;