// TODO: get rid of all of these case statements

var npmBinarySearch = Meteor.npmRequire('binary-search');

function processSubmission (args, jobDone) {
  var submission_id = args.submission_id;

  // // before we begin...
  // var binarysearch = function (array, item) {
  //   return npmBinarySearch(array, item, function (a, b) { return a > b; });
  // };

  // remove all previous submission errors
  WranglerSubmissions.update(submission_id, { $set: { "errors": [] } });
  var errorCount = 0; // increased with addSubmissionError

  // define some helpers
  function hasErrors () {
    return errorCount > 0;
  }
  function setSubmissionStatus (newStatus) {
    console.log("submission:", newStatus);
    WranglerSubmissions.update(submission_id, {$set: {"status": newStatus}});
  }
  function addSubmissionError (description) {
    if (errorCount < 25) {
      WranglerSubmissions.update(submission_id, {
        $addToSet: {
          "errors": description,
        }
      });
    }

    if (!hasErrors()) { // no need to set it twice
      setSubmissionStatus("editing");
    }
    errorCount++;
  }

  // make sure each file is "done"
  WranglerFiles.find({submission_id: submission_id}).forEach(function (doc) {
    if (value.status !== "done") {
      addSubmissionError("File not done: " + value.file_name);
    }
  });
  if (hasErrors()) {
    return jobDone();
  }

  // make sure there are some documents
  var totalCount = WranglerDocuments
      .find({submission_id: submission_id})
      .count();
  if (totalCount === 0) {
    addSubmissionError("No documents present");
    return jobDone();
  }

  // make sure we have only one type of submission type
  var distinctSubmissionTypes = WranglerDocuments.aggregate([
        {$match: {submission_id: submission_id}},
        {$project: {submission_type: 1}},
        {
          $group: {
            _id: null,
            distinct_submission_types: {$addToSet: "$submission_type"}
          }
        },
      ])[0]
      .distinct_submission_types;
  console.log("distinctSubmissionTypes:", distinctSubmissionTypes);
  if (distinctSubmissionTypes.length !== 1) {
    addSubmissionError("Mixed document types");
    return jobDone();
  }
  var submissionType = distinctSubmissionTypes[0];

  var helpers = {
    addSubmissionError: addSubmissionError,
    hasErrors: hasErrors,
  };

  // figure out the right method for doing the rest
  var submissionHandler = wranglerSubmissionHandlers[submissionType];
  if (submissionHandler && submissionHandler.validate) {
    if (submissionHandler.validate(submission_id, helpers)) {
      // can't change it while it's writing to the database
      setSubmissionStatus("writing");

      helpers.doneWriting = function () {
        if (!hasErrors()) {
          setSubmissionStatus("done");
        }
        jobDone();
      };

      submissionHandler.writeToDatabase(submission_id, helpers);
    } else {
      // make sure we have an error message
      if (WranglerSubmissions.findOne(submission_id).errors.length === 0) {
        var message = "Submission validation failed for an unknown reason.";
        addSubmissionError(message);
      }
      return jobDone();
    }
  } else {
    addSubmissionError("Internal error: submission handler not defined");
    return jobDone();
  }






  //
  // var documentBasedTypes = [
  //   "superpathway",
  //   "mutation",
  //   "gene_expression",
  // ];
  // if (documentBasedTypes.indexOf(submissionType) > -1) {
  //

  //
  //   // modify before validation
  //   switch (submissionType) {
  //     case "mutation":

  //       break;
  //     case "superpathway":
  //       WranglerDocuments.update({
  //         submission_id: submission_id,
  //         "document_type": {
  //           $in: [
  //             "superpathway_elements",
  //             "superpathway_interactions"
  //           ]
  //         },
  //       }, {
  //         $set: {
  //           // so that it is valid according to the schema
  //           "contents.superpathway_id": "soon_to_be_created!",
  //         }
  //       }, {multi: true});
  //       break;
  //   }
  //
  //   // validate all objects using their relative schemas
  //   var contextCache = {};
  //   var getContext = function (collectionName) {
  //     if (!contextCache[collectionName]) {
  //       contextCache[collectionName] = getCollectionByName(collectionName)
  //           .simpleSchema()
  //           .newContext();
  //     }
  //     return contextCache[collectionName];
  //   };
  //   errorCount = 0; // defined above
  //   WranglerDocuments.find({submission_id: submission_id})
  //       .forEach(function (object) {
  //     var context = getContext(object.document_type);
  //     if (context.validate(object.contents)) {
  //       // console.log("we all good");
  //     } else {
  //       errorCount++;
  //       addSubmissionError("Invalid document present");
  //       console.log("context.invalidKeys():", context.invalidKeys());
  //       console.log("object.contents:", object.contents);
  //     }
  //   });
  //   if (errorCount > 0) {
  //     addSubmissionError("Invalid documents");
  //     jobDone();
  //     return;
  //   }
  //
  //   // validate for specific types
  //   switch (submissionType) {
  //     case "superpathway":
  //       // make sure they have data for elements and interactions
  //       if (documentCount("superpathway_elements") < 2 ||
  //           documentCount("superpathway_interactions") < 2) {
  //         addSubmissionError("Superpathways must have at least two" +
  //             " elements and two interactions");
  //         jobDone();
  //         return;
  //       }
  //
  //       // make sure each element label is unique
  //       var foundProblem = false;
  //       var elementLabels = documentCursor("superpathway_elements")
  //           .map(function (document) {
  //             return document.contents.label;
  //           });
  //       elementLabels.sort();
  //       _.each(elementLabels.slice(1), function (label, index) {
  //         // index in here are one off from elementLabels (did a slice)
  //         if (label === elementLabels[index]) {
  //           addSubmissionError("Duplicate element names: " + label);
  //           foundProblem = true;
  //         }
  //       });
  //
  //       // make sure labels in interactions are defined in elements
  //       console.log("elementLabels:", elementLabels);
  //       var ensureLabelExists = function (label) {
  //         console.log("label:", label);
  //         console.log("binarysearch(elementLabels, label):", binarysearch(elementLabels, label));
  //         if (binarysearch(elementLabels, label) < 0) {
  //           addSubmissionError(label + " used in interactions without a" +
  //               " corresponding entry in elements");
  //           foundProblem = true;
  //         }
  //       };
  //       documentCursor("superpathway_interactions")
  //           .forEach(function (document) {
  //         ensureLabelExists(document.contents.source);
  //         ensureLabelExists(document.contents.target);
  //       });
  //
  //       // make sure labels defined in elements are used in interactions
  //       _.each(elementLabels, function (label) {
  //         var interaction = WranglerDocuments.findOne({
  //           submission_id: submission_id,
  //           document_type: "superpathway_interactions",
  //           $or: [
  //             {"contents.source": label},
  //             {"contents.target": label},
  //           ],
  //         });
  //         if (!interaction) {
  //           addSubmissionError(
  //               label + " defined but not used in any interactions");
  //           foundProblem = true;
  //         }
  //       });
  //       break;
  //     case "gene_expression":
  //       // insert into expression2
  //       // TODO: figure out a better way to do this...
  //       WranglerDocuments.find({submission_id: submission_id})
  //           .forEach(function (object) {
  //         var prospective = object.contents;
  //         // find the corresponding expression2 entry
  //         var expression2Document = expression2.findOne({
  //           gene: prospective.gene_label,
  //           Study_ID: prospective.study_label,
  //         }, {fields: {samples: 0}});
  //
  //         if (expression2Document) {
  //           var setObject = {};
  //           setObject["samples." +
  //               prospective.sample_label + "." +
  //               prospective.normalization] = prospective.value;
  //
  //           expression2.update(expression2Document._id, { $set: setObject });
  //         } else {
  //           console.log("couldn't find expression2 object for " + prospective.gene_label);
  //         }
  //       });
  //   }
  //
  //   if (foundProblem) {
  //     jobDone();
  //     return;
  //   }
  //
  //   // can't change it while it's writing to the database
  //   setSubmissionStatus("writing");
  //
  //   // modify after validation
  //   switch (submissionType) {
  //     case "superpathway":
  //       var version = 1;
  //       var oldOne = Superpathways.findOne({"name": options.name},
  //           { sort: { version: -1 } });
  //       if (oldOne) {
  //         version = oldOne.version + 1;
  //       }
  //       var superpathwayId = Superpathways.insert({
  //         name: options.name,
  //         version: version,
  //         study_label: options.study_label,
  //         collaboration_label: options.collaboration_label,
  //       });
  //
  //       WranglerDocuments.update({
  //         submission_id: submission_id,
  //         "document_type": {
  //           $in: [
  //             "superpathway_elements",
  //             "superpathway_interactions"
  //           ]
  //         },
  //       }, {
  //         $set: {
  //           "contents.superpathway_id": superpathwayId,
  //         }
  //       }, {multi: true});
  //       break;
  //   }
  //
  //   // TODO: https://docs.mongodb.org/v3.0/tutorial/perform-two-phase-commits/
  //   WranglerDocuments.find({submission_id: submission_id})
  //       .forEach(function (currentDocument) {
  //     getCollectionByName(currentDocument.document_type)
  //         .insert(currentDocument.contents);
  //     WranglerDocuments.update(currentDocument, {
  //       $set: {
  //         "inserted_into_database": true
  //       }
  //     });
  //   });
  //
  //   setSubmissionStatus("done");
  // } else {
  //   setSubmissionStatus("writing");
  //   var prerequisite_job_id;
  //   if (submissionType === "rectangular_gene_expression") {
  //
  //     WranglerFiles.find({submission_id: submission_id})
  //         .forEach(function (wranglerFile) {
  //       prerequisite_job_id = Jobs.insert({
  //         name: "insertRectangularGeneExpression",
  //         user_id: submissionObject.user_id,
  //         date_created: new Date(),
  //         args: {
  //           wrangler_file_id: wranglerFile._id,
  //         },
  //         prerequisite_job_id: prerequisite_job_id,
  //       });
  //     });
  //   } else if (submissionType === "tcga_gene_expression") {
  //     WranglerFiles.find({submission_id: submission_id})
  //         .forEach(function (wranglerFile) {
  //       prerequisite_job_id = Jobs.insert({
  //         name: "insertTCGAGeneExpression",
  //         user_id: submissionObject.user_id,
  //         date_created: new Date(),
  //         args: {
  //           wrangler_file_id: wranglerFile._id,
  //         },
  //         prerequisite_job_id: prerequisite_job_id,
  //       });
  //     });
  //   }
  //
  //   Jobs.insert({
  //     name: "setSubmissionAsFinished",
  //     user_id: submissionObject.user_id,
  //     date_created: new Date(),
  //     args: {
  //       submission_id: submission_id,
  //     },
  //     prerequisite_job_id: prerequisite_job_id,
  //   });
  // }
}

jobMethods.submitWranglerSubmission = {
  argumentSchema: new SimpleSchema({
    "submission_id": { type: Meteor.ObjectID },
  }),
  onRun: processSubmission,
  onError: function (args, errorDescription) {
    WranglerSubmissions.update(args.submission_id, {
      $set: {
        status: "editing",
        errors: ["error running job: " + errorDescription],
      }
    });
  },
};
