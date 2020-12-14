# Flaky tests detection

## Description

This repository contains nodejs script for detecting Implementation-Dependent flaky tests using NonDex tool and Order-Dependent flaky tests using iDFlakies tool. This repository contains `projects` directory for cloning github repositories. Directory `unfixedFlakyTests` contains list of unfixed flaky tests according to the http://mir.cs.illinois.edu/flakytests/unfixed.html. Directory `mockedLogs` contains mocked logs of commands `mvn edu.illinois:nondex-maven-plugin:1.1.2:nondex` and `mvn testrunner:testplugin -Ddetector.detector_type=random-class-method -Ddt.randomize.rounds=10 -Ddt.detector.original_order.all_must_pass=false` for faster development. CSV report contains list of executed tests with a column that indicates whether a test is deleted, not flaky anymore, still flaky, or newly found. 

## Prerequests
 - Node v9.11.2
 - Java SDK 8
 
## Usage

Run the following commands:

```npm install && node script.js```

## Example output log

```
(base) Miloss-MBP:flakytests miloskotlar$ node script.js 
Cloning into 'iDFlakies'...

*****************************************************************
          Running scripts for fastjson project
               Project URL: https://github.com/alibaba/fastjson
*****************************************************************
Latest commit from master branch is a7f1f5c4ac52503cc95bf1d27498098b3093a0df
Current commit from master branch is e05e9c5e4be580691cc55a59f3256595393203a1

Cloning https://github.com/alibaba/fastjson
Cloning into 'fastjson'...
=================================================================
             Running NonDex script for ID tests
               Project Name: fastjson
=================================================================

Runnung projects/fastjson module. This may take up to several hours.
Analysing results, this may take up to several minutes.
=================================================================
             Running iDFlakies script for OD tests
                 Project Name: fastjson
=================================================================

This may take up to several hours.
Runnung projects/fastjson module. This may take up to several hours.
Analysing results, this may take up to several minutes.
Detected changes in 26 tests so far...

.....

Excel report is available at report.csv
```

## Notes

This script doesn't compile downloaded projects and doesn't have all necessary dependencies which can result in missing dependencies and errors in modules during the test executions.
