const express = require('express'); // Import express to create a server
const path = require('path'); // For working with file and directory paths
const cors = require('cors'); // CORS middleware for cross-origin requests
const { MongoClient } = require('mongodb'); // MongoDB client for database interaction

// Constants for file paths
const __filename = path.basename(__filename);
const _dirname = path.dirname(__filename);


// Main asynchronous function to start the server
async function start() {
  // MongoDB connection details
  const url = "mongodb+srv://Smithbadejo1:HebAOXoWURAkvxBE@cluster1.6l4be.mongodb.net/"; // Replace with your MongoDB URI
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db('Webstore'); // Connect to the 'WebStore' database

  // Initialize Express app
  const app = express();
  app.use(cors()); // Enable CORS for all routes
  app.use(express.json()); // Parse JSON bodies in requests

  // Log incoming requests
  app.use((req, res, next) => {
    console.log(`${req.method} request to ${req.url} at ${new Date().toISOString()}`);
    next();
  });

  // Serve images from the 'public/images' folder
  app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

  // Route to get all lessons from the database
  app.get('/lessons', async (req, res) => {
    try {
      const lessons = await db.collection('lessons').find({}).sort({ id: 1 }).toArray();
      res.send(lessons);
    } catch (error) {
      console.error('Error retrieving lessons:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // Route to update lesson spaces
  app.put('/lessons/:id', async (req, res) => {
    try {
      const lessonId = parseInt(req.params.id);
      const { spaces } = req.body;

      if (spaces === undefined || spaces < 0) {
        return res.status(400).json({ message: "Valid spaces value is required." });
      }

      const result = await db.collection('lessons').updateOne(
        { id: lessonId },
        { $set: { spaces } }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({ message: "Lesson not available or no change in spaces." });
      }

      const updatedLesson = await db.collection('lessons').findOne({ id: lessonId });
      res.json(updatedLesson);
    } catch (error) {
      console.error("Error updating lesson:", error);
      res.status(500).json({ message: "An error occurred while updating the lesson." });
    }
  });

  // Route to create a new order
  app.post('/orders', async (req, res) => {
    try {
      const { name, phoneNumber, items } = req.body;

      if (!name || !phoneNumber || !items || items.length === 0) {
        return res.status(400).json({ message: "All fields are required." });
      }

      const lessons = await db.collection('lessons').find({
        id: { $in: items.map(item => item.id) }
      }).toArray();

      if (lessons.length !== items.length) {
        return res.status(404).json({ message: "Some lessons were not found." });
      }

      for (const item of items) {
        const lesson = lessons.find(lesson => lesson.id === item.id);
        if (!lesson || lesson.spaces < item.quantity) {
          return res.status(400).json({
            message: `Not enough spaces for lesson: ${lesson?.subject || item.id}`
          });
        }
      }

      const order = {
        name,
        phoneNumber,
        items,
        totalPrice: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      };

      await db.collection('orders').insertOne(order);
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "An error occurred while creating the order." });
    }
  });

  // Route for search functionality
  app.get('/search', async (req, res) => {
    try {
      const { query } = req.query;
      if (!query) {
        return res.status(400).json({ message: "Search query is required." });
      }

      const regex = new RegExp(query, 'i');
      const searchQuery = {
        $or: [
          { subject: { $regex: regex } },
          { location: { $regex: regex } },
        ]
      };

      const priceQuery = parseFloat(query);
      const spacesQuery = parseInt(query);

      if (!isNaN(priceQuery)) {
        searchQuery.$or.push({ price: priceQuery });
      }

      if (!isNaN(spacesQuery)) {
        searchQuery.$or.push({ spaces: spacesQuery });
      }

      const results = await db.collection('lessons').find(searchQuery).toArray();
      res.json(results);
    } catch (error) {
      console.error("Error during search:", error);
      res.status(500).json({ message: "An error occurred during search!" });
    }
  });

  // Default route (homepage)
  app.get('/', (req, res) => {
    res.send('Welcome to The store to see the lessons go to /lessons');
  });

  // Start the server
  const PORT = 8000;
  app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}!!`);
  });
}

// Call the start function to run the app
start();