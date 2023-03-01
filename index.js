const jimp = require('jimp');
const express = require('express')
var bodyParser = require('body-parser')
var cors = require('cors')

const app = express()
app.use(cors())
app.options('*', cors()) // include before other routes
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
const port = process.env.PORT || 3000; // default port to listen

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.options("/*", function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  res.send(200);
})

app.use(express.static('public'))

// Define route to serve upscaled image
app.get('/image', async (req, res) => {
  // Get the image URL from the query parameter
  const imageUrl = req.query.url;

  // Download the image from the URL
  const image = await jimp.read(imageUrl);

  // Resize the image to a dynamic size without scaling or anti-aliasing
  const size = parseInt(req.query.size) || 512;
  image.resize(size, size, jimp.RESIZE_NEAREST_NEIGHBOR);

  // Set response headers and send upscaled image data to client
  res.setHeader('Content-Type', 'image/png');
  image.getBuffer(jimp.MIME_PNG, (err, buffer) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal server error');
    } else {
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
})


module.exports = app
