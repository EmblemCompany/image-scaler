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
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('CDN-Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=31536000, immutable');
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
})

app.get('/image2', async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('CDN-Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=31536000, immutable');
  const { url, size } = req.query;
  let uri = url.split(' ').join('+')
  // let width = parseInt(size) || 512
  let height = parseInt(size) || 512

  try {
      if (!url || !height) {
          return res.status(400).send("Bad request. Please make sure 'uri', 'width' and 'height' parameters are provided.");
      }

      const image = await processImage(uri, Number(height));

      res.setHeader('Content-Type', image.type);
      res.send(image.bytes);
  } catch (error) {
      console.error(error);
      res.status(500).send("An error occurred while processing the image.");
  }
})

async function processImage(uri, height) {
  let imageBuffer;

  if (uri.startsWith('data:')) {
    // let maybeText = handleText(uri, width, height)
    // if(maybeText) return maybeText
    imageBuffer = dataUriToBuffer(uri);
  } else {
      const response = await axios.get(uri, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(response.data, 'binary');
  }
  if (!imageBuffer || imageBuffer.length == 0) {
    return false
  }
  const image = sharp(imageBuffer)
  const metadata = await sharp(imageBuffer).metadata();
  console.log(metadata)
  let resizedImage = await image
      .resize(null, height, { 
          fit: 'inside', 
          kernel: sharp.kernel.nearest 
      })
  let resizedImageBuffer = await resizedImage
      //.toFormat('png')
      .toBuffer();

  return {type: `image/${metadata.format}`, bytes: resizedImageBuffer}
}

async function handleText(uri, width, height) {
  try {
    let maybeText = uri.split(':,')[1] 
    let parsed = maybeText? JSON.parse(maybeText.replace(/\\/g, '')): null
    if (parsed) {
      return makeTextImage(parsed, width, height)
    } 
    return false
  } catch (error) {
    console.log(error)
    return false
  }
}

async function makeTextImage(text, width, height) {
  let template = `<?xml version="1.0" encoding="utf-8"?>
  <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
  <svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xhtml="http://www.w3.org/1999/xhtml"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     version="1.1"
     viewBox="0 0 512 512"
     preserveAspectRatio="xMinYMin meet"
     style="background-color:white;">
     <foreignObject width="512" height="512">
        <xhtml:div style="display: flex; align-items: center; justify-content: center; height: 100%; color: black; text-align: center;">
           ${JSON.stringify(text, null, 4)}
        </xhtml:div>
     </foreignObject>
  </svg>`
  return {bytes: Buffer.from(template), type: 'image/svg+xml'}
}



// Start the server
const PORT = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
})


module.exports = app
