import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";

const app = express();
dotenv.config();
const corsOptions = {
    origin: 'http://localhost:3000',
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const connect = async () => {
    try {
        await mongoose.connect(process.env.MONGO);
    } catch (error) {
        throw error;
    }
};
mongoose.connection.on("disconnected", () => {
    console.log("Mongo db disconnected");
})
mongoose.connection.on("connected", () => {
    console.log("Mongo db connected");
})

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    pic: String,
    date: Date,
    tweets: [{
        postDescription: String,
        like: Number,
        comment: Number,
        shareCount: Number,
    }],
});

const User = mongoose.model('User', userSchema);

// Registration
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'User already exists' });
        }

        const newUser = new User({ username, email, password });
        const savedUser = await newUser.save();
        const token = jwt.sign({ userId: savedUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ user: savedUser, token });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.password !== password) {
            return res.status(401).json({ message: 'Incorrect password' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ user, token });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Middleware to verify token
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({ message: 'Token missing' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log(token);
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.userId = decoded.userId;
        next();
    });
};

// Retrieve User's Tweets
app.get('/api/user/tweets/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const tweetsWithLikeCount = user.tweets.map(tweet => {
            return {
                ...tweet.toObject(),
                likeCount: tweet.like,
                retweetCount:tweet.retweet,
                shareCount:tweet.share,

            };
        });

        res.json(tweetsWithLikeCount);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Add New Tweet
app.post('/api/user/tweets/:id', async (req, res) => {
    try {
        const { id } = req.params; 
        const { postDescription, like, comment, shareCount } = req.body;

        const user = await User.findById(id); 
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const newTweet = {
            postDescription,
            like,
            comment,
            shareCount,
        };
        user.tweets.push(newTweet);
        await user.save();
        res.status(201).json(user.tweets);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});


//for count
app.post('/api/user/tweets/:userId/:tweetId/action',  async (req, res) => {
    try {
        const userId = req.params.userId;
        const tweetId = req.params.tweetId;
        const { action } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const tweet = user.tweets.id(tweetId);
        if (!tweet) {
            return res.status(404).json({ message: 'Tweet not found' });
        }

        if (action === 'like') {
            tweet.like += 1;
        } else if (action === 'retweet') {
            tweet.retweet += 1;
        } else if (action === 'share') {
            tweet.share += 1;
        }

        await user.save();

        res.status(200).json({ message: 'Action count updated successfully', updatedTweet: tweet });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});
// Delete a tweet
app.delete('/api/user/tweets/:userId/:tweetId', async (req, res) => {
    try {
      const userId = req.params.userId;
      const tweetId = req.params.tweetId;
  
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      const tweet = user.tweets.id(tweetId);
      if (!tweet) {
        return res.status(404).json({ message: 'Tweet not found' });
      }
  
      tweet.remove();
      await user.save();
  
      res.status(200).json({ message: 'Tweet deleted successfully' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });


app.listen(8000, () => {
    connect();
    console.log('Server is running on port 8000');
});
