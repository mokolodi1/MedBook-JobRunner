// the keys here correspond to Jobs.name in the Jobs collection
jobMethods = {};

// makes it easy to read a file line by line:
// calls callWithLine with each successive line of the file
lineByLineStream = function(fileObject, callWithLine, callOnEnd) {
  var lineIndex = 0;

  var byLine = Meteor.npmRequire('byline');
  var stream = byLine(fileObject.createReadStream("blobs"))
    .on('data', Meteor.bindEnvironment(function (lineObject) {
      var line = lineObject.toString();
      callWithLine(line, lineIndex);
      lineIndex++;
    }));
  if (callOnEnd) {
    stream.on('end', callOnEnd);
  }
  return stream;
};

firstPartOfLine = function (line) {
  let maxLength = 50;
  let firstPart = line.substring(0, maxLength);
  if (firstPart !== line) {
    firstPart = firstPart.substring(0, maxLength - 3) + "...";
  }
  return firstPart;
};
