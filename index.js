const jimp = require('jimp');
const express = require('express');
const app = express();
const port = 3000;

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
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
