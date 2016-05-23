var fs = require('fs');
var sh = require('execSync');
var targetSource;
var targetExe;
var targetInput;
var fileName;

process.on('message', function(message) {
    // Process data
    fileName = message.user + message.id;

    pathToSource = __dirname + "/users/" + message.user + "/";
    if (!fs.existsSync(pathToSource)){
       fs.mkdirSync(pathToSource);
    }

    targetSource = pathToSource + fileName + ".cpp";
    targetExe = "users/exe/" + fileName;
    targetInput = pathToSource + "input/" + fileName + ".txt";
       
     if (!fs.existsSync(pathToSource + "input/")){
       fs.mkdirSync(pathToSource + "input/");
    }


    fs.writeFile(targetSource, message.script, function(err) {
        fs.writeFile(targetInput, message.inputs, function(err) {
            var result = sh.exec("g++ " + targetSource + " -o " + targetExe);
            if (result.code == 1) { //error
                process.send({error: result.stdout, success:false, id:message.id});
            } else  { //success
                var start = new Date().getTime();
                var result2 = sh.exec("cd users/exe; ./" + fileName + " < " + targetInput);
                if (result2.code == 1) { //error
                    process.send({error: result2.stdout, success:false, id:message.id});
                } else  { //success
                    var end = new Date().getTime();
                    var time = end - start;
                    process.send({result: result2.stdout, timeExec: time, success:true, id:message.id});
                }
            }
        });
    });
});
