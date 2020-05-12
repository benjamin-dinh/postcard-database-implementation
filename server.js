// server.js
// where your node app starts

// include modules
const express = require('express');

const multer = require('multer');
const bodyParser = require('body-parser');
const fs = require('fs');
const sql = require('sqlite3').verbose();
const FormData = require("form-data");

// CREATE / SELECT DATABASE
// This creates an interface to the file if it already exists, and makes the file if it does not. 
const postcardDB = new sql.Database("postcards.db");
// Create table if "postcardData.db" is not found or empty
let cmd = "SELECT * FROM sqlite_master WHERE type='table' AND name='PostcardTable' ";
postcardDB.get(cmd, function (err, val) {
    console.log(err, val);
    if (val == undefined) {
        console.log("No database file - creating one");
        createDatabase();
    } else {
        console.log("Database file found");
    }
});
function createDatabase(){
  const cmd = 'CREATE TABLE PostcardTable (rowIdNum INTEGER PRIMARY KEY, message TEXT, image TEXT, font TEXT, color TEXT, url TEXT)';
  postcardDB.run(cmd, function(err, val) {
    if (err) {
      console.log("Database creation failure", err.message);
    } else {
      console.log("Created database");
    }
  });
}

// URL GENERATOR
function makeid(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

// API 
function sendMediaStore(filename, serverRequest, serverResponse) {
  let apiKey = process.env.ECS162KEY;
  if (apiKey === undefined) {
    serverResponse.status(400);
    serverResponse.send("No API key provided");
  } else {
    // we'll send the image from the server in a FormData object
    let form = new FormData();

    // we can stick other stuff in there too, like the apiKey
    form.append("apiKey", apiKey);
    // stick the image into the formdata object
    form.append("storeImage", fs.createReadStream(__dirname + filename));
    // and send it off to this URL
    form.submit("http://ecs162.org:3000/fileUploadToAPI", function(err, APIres) {
      // did we get a response from the API server at all?
      if (APIres) {
        // OK we did
        console.log("API response status", APIres.statusCode);
        // the body arrives in chunks - how gruesome!
        // this is the kind stream handling that the body-parser 
        // module handles for us in Express.  
        let body = "";
        APIres.on("data", chunk => {
          body += chunk;
        });
        APIres.on("end", () => {
          // now we have the whole body
          if (APIres.statusCode != 200) {
            serverResponse.status(400); // bad request
            serverResponse.send(" Media server says: " + body);
          } else {
            serverResponse.status(200);
            serverResponse.send(body);
          }
          let slicedFilename = filename.slice(1);
          fs.unlink(slicedFilename);
        });
      } else { // didn't get APIres at all
        serverResponse.status(500); // internal server error
        serverResponse.send("Media server seems to be down.");
      }
    });
  }
}



let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, __dirname+'/images')    
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

// let upload = multer({dest: __dirname+"/assets"});
let upload = multer({storage: storage});

// begin constructing the server pipeline
const app = express();


// Serve static files out of public directory
app.use(express.static('public'));

// Also serve static files out of /images
app.use("/images",express.static('images'));

// Handle GET request to base URL with no other route specified
// by sending creator.html, the main page of the app
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/public/creator.html');
});

// Handle a post request to upload an image. 
app.post('/upload', upload.single('newImage'), function (request, response) {
  console.log("Received",request.file.originalname,request.file.size,"bytes")
  if(request.file) {
    sendMediaStore('/images/'+request.file.originalname ,request, response);
    // response.end("recieved "+request.file.originalname);
  }
  else throw 'error';
});

app.use(bodyParser.json());
// POST POSTCARD DATA IN DATABASE
app.post('/sharePostcard', function (req, res) {
  // console.log("Server received", req.body);
  // write the JSON into postcardData.json
  // fs.writeFile(__dirname + '/public/postcardData.json', JSON.stringify(req.body), (err) => {
  //   if(err) {
  //     res.status(404).send('postcard not saved');
  //   } else {
  //     res.send("All well")
  //   }
  // })
  let image1 = req.body.image;
  let color1 = req.body.color;
  let font1 = req.body.font;
  let message1 = req.body.message;
  let url1 = makeid(22);
  // Insert into database
  cmd = 'INSERT INTO PostcardTable(message, image, font, color, url) VALUES (?,?,?,?,?)';
  postcardDB.run(cmd, message1, image1, font1, color1, url1, function(err) {
    if (err) {
      console.log("DB insert error",err.message);
      // next();
    } 
    res.send(url1);
  });
});

// GET POSTCARD FROM DATABASE USING URL
app.get("/showPostcard", function (request, response, next) {
  let r = request.query.id;
  let cmd2 = "SELECT * FROM PostcardTable WHERE url=?";
  postcardDB.get(cmd2, r, function(err, val){
    if(err){
      console.log("error: ", err.message);
      next();
    }
    else{
      console.log("Received: ", val);
      response.json(val);
    }
  });
});


// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});

