const jimp = require('jimp')
const express = require('express')
var bodyParser = require('body-parser')
var cors = require('cors')
const request = require('request')
const rp = require('request-promise-native')
const axios = require('axios')
const { dataUriToBuffer } = require('data-uri-to-buffer')
const sharp = require('sharp')

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
  try {
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
    })
  } catch(err){
    const remoteResponse = await rp.get(imageUrl, {
      resolveWithFullResponse: true,
      encoding: null, // To receive the response as a Buffer
    });

    const contentType = remoteResponse.headers['content-type'];
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    // Pipe the remote response stream to the client response stream
    request.get(imageUrl).pipe(res);
    // return res.send('<html><head></head><body><script>location.href = \'' + imageUrl + '\'</script></body></html>');
  }
});

async function resizeImage(uri, width, height) {
  let imageBuffer;

  if (uri.startsWith('data:')) {
      imageBuffer = dataUriToBuffer(uri);
  } else {
      const response = await axios.get(uri, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(response.data, 'binary');
  }

  const resizedImageBuffer = await sharp(imageBuffer)
      .resize(width, height, { 
          fit: 'fill', 
          kernel: sharp.kernel.nearest 
      })
      .toFormat('png')
      .toBuffer();

  return resizedImageBuffer;
}

app.get('/image2', async (req, res) => {
  const { url, size } = req.query;
  let uri = url.split(' ').join('+')
  let width = parseInt(size) || 512
  let height = parseInt(size) || 512

  try {
      if (!url || !width || !height) {
          return res.status(400).send("Bad request. Please make sure 'uri', 'width' and 'height' parameters are provided.");
      }

      const image = await resizeImage(uri, Number(width), Number(height));

      res.setHeader('Content-Type', 'image/png');
      res.send(image);
  } catch (error) {
      console.error(error);
      res.status(500).send("An error occurred while processing the image.");
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
})


module.exports = app
