var spawn = Npm.require('child_process').spawn;
var temp = Meteor.npmRequire('temp'); // TODO: is my manual cleanup enough?
var path = Npm.require('path');
var fs = Npm.require('fs');

function removeForce(path) {
  rm = spawn("rm", ["-rf", path]);

  rm.stdout.on("data", function (data) {
    console.log("stdout:", data);
  });
  rm.stderr.on("data", function (data) {
    console.log("stderr:", data);
  });
  rm.on("close", function (exitCode) {
    console.log("exited rm with code", exitCode);
  });
}

parsingFunctions.uncompressTarGz = function(compressedFile, helpers,
    jobDone) {
  // TODO: helper.onError with console log messages

  // TODO: delete these folders
  temp.mkdir('uncompressTarGz',
      Meteor.bindEnvironment(function(err, workingDir) {
    if (err) {
      console.elog("error creating working directory (uncompressTarGz):", err);
      return;
    }

    console.log("workingDir:", workingDir);

    var compressedFileName = compressedFile.original.name;
    var compressedPath = path.join(workingDir, compressedFileName);
    var readStream = compressedFile.createReadStream('blobs');
    var writeStream = fs.createWriteStream(compressedPath);

    // write the compressed file to workingDir
    readStream.on("data", function (chunk) {
      writeStream.write(chunk);
    });
    readStream.on("end", Meteor.bindEnvironment(function () {
      helpers.setFileStatus("processing");

      // note: don't care about stdout (files listed on stderr)
      var errorArray = [];

      // spawn a process to decompress the tar file
      tar = spawn("tar", ["-zxvf", compressedFileName], { cwd: workingDir });
      tar.stderr.on("data", function (data) {
        // write all of that file to the errorArray
        errorArray.push(data.toString());
      });
      tar.on("close", Meteor.bindEnvironment(function (exitCode) {
        if (exitCode !== 0) {
          console.log("error running tar job:", compressedFileName);
          jobDone();
        } else {
          // // remove compressed file
          // removeForce(compressedPath);

          // filter so we don't get empty lines or folders (end with '/')
          // then map over them to remove the "x " before each line
          var fileNames = _.map(_.filter(errorArray.join("").split("\n"),
                  function (consoleLine) {
                var hiddenFileMatches = consoleLine.match(/\/\./g);

                return consoleLine.length > 0 &&
                    consoleLine.slice(-1) !== "/" &&
                    hiddenFileMatches === null;
              }), function (consoleLine) {
                return consoleLine.substring(2);
              });

          // process each file
          // var successfullyInserted = 0;
          // var toInsertCount = fileNames.length;
          _.each(fileNames, function (newFileName) {
            console.log("newFileName:", newFileName);
            // insert: this kind of insert only works on the server
            var blobObject = Blobs.insert(path.join(workingDir, newFileName));

            // set some stuff about the new file
            blobObject.name(newFileName);
            var submissionId = compressedFile.metadata.submission_id;
            Blobs.update({_id: blobObject._id}, {
              $set: {
                "metadata.uncompressed_from_id": compressedFile._id,
                "metadata.user_id": compressedFile.metadata.user_id,
                "metadata.submission_id": submissionId,
              }
            });

            var wranglerFileId = WranglerFiles.insert({
              "submission_id": submissionId,
              "user_id": compressedFile.metadata.user_id,
              "blob_id": blobObject._id,
              "blob_name": newFileName,
              "status": "saving",
              "uncompressed_from_id": compressedFile._id,
            });

            Jobs.insert({
              "name": "differentiateWranglerFile",
              "date_created": new Date(),
              "args": {
                "wrangler_file_id": wranglerFileId,
              },
            });

            // successfullyInserted++;
            // if (successfullyInserted === toInsertCount) {
            //
            // }
          });

          helpers.setFileStatus("done");
          jobDone();

          // TODO: remove the compressed file from the submission?
        }
      }));
    }));
  }));
};