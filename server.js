const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const canvas = require('canvas');
const { createCanvas } = require('canvas')

const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const fs = require('fs');
const path = require('path');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Load environment variables from .env file
require('dotenv').config()
const accessToken = process.env.EMOJI_API_KEY;

const app = express();
const PORT = 3000;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

const dbFileName = 'microblog.db';
let db;
async function connectToDatabase() {
    db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });
    console.log('Connected to the SQLite database');
}

// Configure passport
passport.use(new GoogleStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: `http://localhost:${PORT}/auth/google/callback`
}, async (token, tokenSecret, profile, done) => {
    try {
        const user = await findOrCreateUser(profile);
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await findUserById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});
/*
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Handlebars Helpers

    Handlebars helpers are custom functions that can be used within the templates 
    to perform specific tasks. They enhance the functionality of templates and 
    help simplify data manipulation directly within the view files.

    In this project, two helpers are provided:
    
    1. toLowerCase:
       - Converts a given string to lowercase.
       - Usage example: {{toLowerCase 'SAMPLE STRING'}} -> 'sample string'

    2. ifCond:
       - Compares two values for equality and returns a block of content based on 
         the comparison result.
       - Usage example: 
            {{#ifCond value1 value2}}
                <!-- Content if value1 equals value2 -->
            {{else}}
                <!-- Content if value1 does not equal value2 -->
            {{/ifCond}}
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

// Set up Handlebars view engine with custom helpers
//
app.engine(
    'handlebars',
    expressHandlebars.engine({
        helpers: {
            toLowerCase: function (str) {
                return str.toLowerCase();
            },
            ifCond: function (v1, v2, options) {
                if (v1 === v2) {
                    return options.fn(this);
                }
                return options.inverse(this);
            },
        },
    })
);

app.set('view engine', 'handlebars');
app.set('views', './views');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Middleware
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.use(
    session({
        secret: 'oneringtorulethemall',     // Secret key to sign the session ID cookie
        resave: false,                      // Don't save session if unmodified
        saveUninitialized: false,           // Don't create session until something stored
        cookie: { secure: false },          // True if using https. Set to false for development without https
    })
);

// Replace any of these variables below with constants for your application. These variables
// should be used in your template files. 
// 
app.use((req, res, next) => {
    res.locals.appName = 'MicroBlog';
    res.locals.copyrightYear = 2024;
    res.locals.postNeoType = 'Post';
    res.locals.loggedIn = req.session.loggedIn || false;
    res.locals.userId = req.session.userId || '';
    next();
});

app.use(express.static('public'));                  // Serve static files
app.use(express.urlencoded({ extended: true }));    // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json());                            // Parse JSON bodies (as sent by API clients)
app.use(express.static(path.join(__dirname, 'public')));

app.use(passport.initialize());
app.use(passport.session());
// Support Functions
async function findOrCreateUser(profile) {
    const hashedGoogleId = `hashedGoogleId${profile.id}`;
    let user = await db.get('SELECT * FROM users WHERE hashedGoogleId = ?', [hashedGoogleId]);

    if (!user) {
        // Ensure the 'avatars' directory exists
        if (!fs.existsSync(path.join(__dirname, 'public', 'avatars'))) {
            fs.mkdirSync(path.join(__dirname, 'public', 'avatars'), { recursive: true });
        }

        const letter = profile.displayName.charAt(0).toUpperCase();
        const avatarBuffer = generateAvatar(letter);
        const avatarFilename = `${hashedGoogleId}.png`;
        const avatarPath = path.join(__dirname, 'public', 'avatars', avatarFilename);
        fs.writeFileSync(avatarPath, avatarBuffer);

        await db.run(
            'INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)',
            [`user_${profile.id}`, hashedGoogleId, `/avatars/${avatarFilename}`, new Date().toISOString()]
        );
        user = await db.get('SELECT * FROM users WHERE hashedGoogleId = ?', [hashedGoogleId]);
    }

    return user;


}


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Home route: render home view with posts and user
// We pass the posts and user variables into the home
// template
//
// Routes for Google OAuth
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), async (req, res) => {
    const user = await findUserById(req.user.id);
    if (user.username.startsWith('user_')) {
        return res.redirect('/registerUsername');
    }
    req.session.userId = user.id;
    req.session.loggedIn = true;
    res.redirect('/');
});

// Route for registering a username
app.get('/registerUsername', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/login');
    }
    res.render('registerUsername', { googleId: req.user.id });
});

app.post('/registerUsername', async (req, res) => {
    // const { username } = req.body;
    // const googleId = req.session.passport.user;

    // const existingUser = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    // if (existingUser) {
    //     return res.render('registerUsername', { error: 'Username already exists', googleId });
    // }

    // await db.run('UPDATE users SET username = ? WHERE hashedGoogleId = ?', [username, `hashedGoogleId${googleId}`]);
    // const user = await db.get('SELECT * FROM users WHERE hashedGoogleId = ?', [`hashedGoogleId${googleId}`]);
    // req.session.userId = user.id;
    // req.session.loggedIn = true;
    // res.redirect('/');

    const { username } = req.body;
    const googleId = req.user.id;

    try {
        const existingUser = await db.get('SELECT * FROM users WHERE username = ?', [username]);

        if (existingUser) {
            return res.render('registerUsername', { error: 'Username already exists' });
        }

        await db.run('UPDATE users SET username = ? WHERE id = ?', [username, googleId]);
        const user = await db.get('SELECT * FROM users WHERE id = ?', [googleId]);
        req.session.userId = user.id;
        req.session.loggedIn = true;
        res.redirect('/');
    } catch (err) {
        console.error('Error updating username:', err);
        res.render('registerUsername', { error: 'Database error' });
    }



});

// Route for logging out
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/googleLogout');
    });
});

app.get('/googleLogout', (req, res) => {
    res.render('googleLogout');
});

app.get('/logoutCallback', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/');
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});
app.get('/', async (req, res) => {
    try {
        const filter = req.query.filterOption;
        const posts = await getPosts(filter);
        const user = await getCurrentUser(req);
        const temp = accessToken;
        res.render('home', { posts, user, temp });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.redirect('/error');
    }


});
// Register GET route is used for error response from registration
//
app.get('/register', (req, res) => {
    res.render('loginRegister', { regError: req.query.error });
});

// Login route GET route is used for error response from login
//
app.get('/login', (req, res) => {
    res.render('loginRegister', { loginError: req.query.error });
});

// Error route: render error page
//
app.get('/error', (req, res) => {
    res.render('error');
});

// Additional routes that you must implement

app.get('/post/:id', async (req, res) => { // This route should render a single post
    const postId = parseInt(req.params.id, 10);
    try {
        const post = await db.get('SELECT * FROM posts WHERE id = ?', [postId]);
        if (!post) {
            return res.redirect('/error');
        }
        const user = await getCurrentUser(req);
        res.render('post', { post, user });
    } catch (error) {
        console.error('Error fetching post:', error);
        res.redirect('/error');
    }
});

app.post('/posts', async (req, res) => { // This route should add a new post
    // TODO: Add a new post and redirect to home
    // const { title, content } = req.body;
    // const user = getCurrentUser(req);
    // if (!user) {
    //     return res.redirect('/login');
    // }
    // addPost(title, content, user);
    // res.redirect('/');

    const { title, content } = req.body;
    const user = await getCurrentUser(req);
    if (!user) {
        console.log('User not logged in');
        return res.redirect('/login');
    }
    await addPost(title, content, user);
    res.redirect('/');

});
app.post('/like/:id', async (req, res) => { // This route should increment the likes of a post
    // TODO: Update post likes
    // const postId = parseInt(req.params.id, 10);
    // const post = posts.find(p => p.id === postId);
    // if (post) {
    //     post.likes += 1;
    // }
    // let temp = post.likes
    // res.json({ success: true, likes: temp });
    // res.redirect('/');

    console.log('Like post:', req.params.id);
    const postId = parseInt(req.params.id, 10);

    try {
        await db.run('UPDATE posts SET likes = likes + 1 WHERE id = ?', [postId]);
        const row = await db.get('SELECT likes FROM posts WHERE id = ?', [postId]);
        console.log('Updated post:', row); // Debug log
        res.json({ success: true, likes: row.likes });
    } catch (err) {
        console.error('Error updating post likes:', err);
        res.json({ success: false });
    }

});
app.get('/profile', isAuthenticated, async (req, res) => { // This route should render the profile page
    // TODO: Render profile page
    // const user = getCurrentUser(req);
    // if (!user) {
    //     return res.redirect('/login');
    // }

    // const userPosts = posts.filter(post => post.username === user.username);
    // res.render('profile', { user, posts: userPosts });
    const user = await getCurrentUser(req);
    if (!user) {
        return res.redirect('/login');
    }

    try {
        const userPosts = await db.all(`
            SELECT posts.*, users.avatar_url
            FROM posts
            JOIN users ON posts.username = users.username
            WHERE posts.username = ?
            ORDER BY posts.timestamp DESC
        `, [user.username]);
        res.render('profile', { user, posts: userPosts });
    } catch (error) {
        console.error('Error fetching user posts:', error);
        res.redirect('/error');
    }



});
app.get('/avatar/:username', (req, res) => {
    // TODO: Serve the avatar image for the user
    const username = req.params.username;
    console.log(`Generating avatar for: ${username}`);
    const letter = username.charAt(0).toUpperCase();

    // Generate the avatar
    const avatarBuffer = generateAvatar(letter);

    // Set the content type to PNG and send the buffer
    res.setHeader('Content-Type', 'image/png');
    res.send(avatarBuffer);
});
app.post('/register', async (req, res) => {
    // TODO: Register a new user
    // const { username } = req.body;
    // console.log(`Attempting to register user: ${username}`);

    // if (findUserByUsername(username)) {
    //     console.log(`Registration failed: Username ${username} already exists`);
    //     return res.redirect('/register?error=Username already exists');
    // }

    // addUser(username);
    // const user = findUserByUsername(username);
    // req.session.userId = user.id;
    // req.session.loggedIn = true;
    // console.log(`Session data before save:`, req.session);

    // req.session.save(err => {
    //     if (err) {
    //         console.error('Session save error:', err);
    //         return res.redirect('/register?error=Session save error');
    //     }
    //     console.log(`Session data after save:`, req.session);
    //     console.log(`User ${username} registered successfully with ID ${user.id}`);
    //     res.redirect('/');
    // });

    const { username } = req.body;
    console.log(`Attempting to register user: ${username}`);

    if (await findUserByUsername(username)) {
        console.log(`Registration failed: Username ${username} already exists`);
        return res.redirect('/register?error=Username already exists');
    }

    await addUser(username);
    const user = await findUserByUsername(username);
    req.session.userId = user.id;
    req.session.loggedIn = true;
    console.log(`Session data before save:`, req.session);

    req.session.save(err => {
        if (err) {
            console.error('Session save error:', err);
            return res.redirect('/register?error=Session save error');
        }
        console.log(`Session data after save:`, req.session);
        console.log(`User ${username} registered successfully with ID ${user.id}`);
        res.redirect('/');
    });
});
app.post('/login', async (req, res) => {
    // TODO: Login a user
    // const { username } = req.body;
    // console.log(`Attempting to log in user: ${username}`);

    // const user = findUserByUsername(username);
    // if (!user) {
    //     console.log(`Login failed: Invalid username ${username}`);
    //     return res.redirect('/login?error=Invalid username');
    // }

    // req.session.userId = user.id;
    // req.session.loggedIn = true;
    // console.log(`Session data before save:`, req.session);

    // req.session.save(err => {
    //     if (err) {
    //         console.error('Session save error:', err);
    //         return res.redirect('/login?error=Session save error');
    //     }
    //     console.log(`Session data after save:`, req.session);
    //     console.log(`User ${username} logged in successfully with ID ${user.id}`);
    //     res.redirect('/');
    // });
    const { username } = req.body;
    console.log(`Attempting to log in user: ${username}`);

    const user = await findUserByUsername(username);
    if (!user) {
        console.log(`Login failed: Invalid username ${username}`);
        return res.redirect('/login?error=Invalid username');
    }

    console.log('User found during login:', user); // Debug log

    req.session.userId = user.id;
    req.session.loggedIn = true;
    console.log(`Session data before save:`, req.session);

    req.session.save(err => {
        if (err) {
            console.error('Session save error:', err);
            return res.redirect('/login?error=Session save error');
        }
        console.log(`Session data after save:`, req.session);
        console.log(`User ${username} logged in successfully with ID ${user.id}`);
        res.redirect('/');
    });
});
app.get('/logout', (req, res) => {
    // TODO: Logout the user
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/');
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});
app.post('/delete/:id', isAuthenticated, async (req, res) => {
    // TODO: Delete a post if the current user is the owner
    // const postId = parseInt(req.params.id, 10);
    // // remove the post from the posts array
    // posts = posts.filter(post => post.id !== postId);
    // console.log(`Post with ID ${postId} deleted`);
    // res.redirect('/');
    const postId = parseInt(req.params.id, 10);
    const user = await getCurrentUser(req);
    try {
        await db.run('DELETE FROM posts WHERE id = ? AND username = ?', [postId, user.username]);
        res.redirect('/');
    } catch (error) {
        console.error('Error deleting post:', error);
        res.redirect('/error');
    }
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.listen(PORT, async () => {

    // console.log(`Server is running on http://localhost:${PORT}`);
    await connectToDatabase();
    console.log(`Server is running on http://localhost:${PORT}`);

});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Example data for posts and users
let posts = [
    { id: 1, title: 'Sample Post', content: 'This is a sample post.', username: 'SampleUser', timestamp: '2024-01-01 10:00', likes: 0 },
    { id: 2, title: 'Another Post', content: 'This is another sample post.', username: 'AnotherUser', timestamp: '2024-01-02 12:00', likes: 0 },
];
let users = [
    { id: 1, username: 'SampleUser', avatar_url: undefined, memberSince: '2024-01-01 08:00' },
    { id: 2, username: 'AnotherUser', avatar_url: undefined, memberSince: '2024-01-02 09:00' },
];

// Function to find a user by username
async function findUserByUsername(username) {
    // TODO: Return user object if found, otherwise return undefined
    // return users.find(user => user.username === username);
    try {
        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        console.log('User found by username:', user); // Debug log
        return user;
    } catch (error) {
        console.error('Error finding user by username:', error);
        return undefined;
    }
}

// Function to find a user by user ID
async function findUserById(userId) {
    // TODO: Return user object if found, otherwise return undefined
    try {
        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
        console.log('User found by ID:', user); // Debug log
        return user;
    } catch (error) {
        console.error('Error finding user by ID:', error);
        return undefined;
    }
}

// Function to add a new user
async function addUser(username) {
    // TODO: Create a new user object and add to users array
    // const newUser = {
    //     id: users.length + 1,
    //     username,
    //     avatar_url: undefined,
    //     memberSince: new Date().toISOString(),
    // };
    // users.push(newUser);
    // console.log(`User ${username} added with ID ${newUser.id}`);

    // const hashedGoogleId = `hashedGoogleId${username}`;  // This is just an example of how you might generate a hashedGoogleId
    // const avatar_url = '';  // Default avatar URL
    // const memberSince = new Date().toISOString();  // Current date and time

    // try {
    //     await db.run(
    //         'INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)',
    //         [username, hashedGoogleId, avatar_url, memberSince]
    //     );
    //     console.log(`User ${username} added to the database`);
    // } catch (error) {
    //     console.error('Error adding user to the database:', error);
    // }
    const hashedGoogleId = `hashedGoogleId${username}`;
    const letter = username.charAt(0).toUpperCase();
    const avatarBuffer = generateAvatar(letter);
    const avatarFilename = `${hashedGoogleId}.png`;
    const avatarPath = path.join(__dirname, 'public', 'avatars', avatarFilename);

    try {
        const existingUser = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUser) {
            console.log(`Registration failed: Username ${username} already exists`);
            return { success: false, message: 'Username already exists' };
        }

        fs.writeFileSync(avatarPath, avatarBuffer);

        await db.run(
            'INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)',
            [username, hashedGoogleId, `/avatars/${avatarFilename}`, new Date().toISOString()]
        );
        console.log(`User ${username} added to the database`);
        return { success: true };
    } catch (error) {
        console.error('Error adding user to the database:', error);
        return { success: false, message: 'Database error' };
    }



}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    console.log(req.session.userId);
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Function to register a user
function registerUser(req, res) {
    // TODO: Register a new user and redirect appropriately
}

// Function to login a user
function loginUser(req, res) {
    // TODO: Login a user and redirect appropriately

}

// Function to logout a user
function logoutUser(req, res) {
    // TODO: Destroy session and redirect appropriately
}

// Function to render the profile page
function renderProfile(req, res) {
    // TODO: Fetch user posts and render the profile page
}

// Function to update post likes
function updatePostLikes(req, res) {
    // TODO: Increment post likes if conditions are met
}

// Function to handle avatar generation and serving
function handleAvatar(req, res) {
    // TODO: Generate and serve the user's avatar image
}

// Function to get the current user from session
async function getCurrentUser(req) {
    // TODO: Return the user object if the session user ID matches
    // return findUserById(req.session.userId);
    // return req.session.userId ? { id: req.session.userId } : null;
    const userId = req.session.userId;
    if (!userId) {
        return null;
    }

    try {
        const user = await findUserById(userId);
        console.log('getCurrentUser - User:', user);
        return user;
    } catch (error) {
        console.error('Error fetching current user:', error);
        return null;
    }

}

// Function to get all posts, sorted by latest first
async function getPosts(filter) {
    if(!filter) {
        try {
            return await db.all(`
            SELECT posts.*, users.avatar_url
            FROM posts
            JOIN users ON posts.username = users.username
            ORDER BY posts.timestamp DESC
            `)  ;
        } catch (error) {
            console.error('Error fetching posts', error);
        }
    } else {
        if(filter === 'likes'){
            try {
                return await db.all(`
                SELECT posts.*, users.avatar_url
                FROM posts
                JOIN users ON posts.username = users.username
                ORDER BY posts.likes DESC
                `)  ;
            } catch (error) {
                console.error('Error fetching posts', error);
            }
        }
        if(filter === 'new'){
            try {
                return await db.all(`
                SELECT posts.*, users.avatar_url
                FROM posts
                JOIN users ON posts.username = users.username
                ORDER BY posts.timestamp DESC
                `)  ;
            } catch (error) {
                console.error('Error fetching posts', error);
            }
        }
        if(filter === 'old'){
            try {
                return await db.all(`
                SELECT posts.*, users.avatar_url
                FROM posts
                JOIN users ON posts.username = users.username
                ORDER BY posts.timestamp ASC
                `)  ;
            } catch (error) {
                console.error('Error fetching posts', error);
            }
        }

    }
}

// Function to add a new post
async function addPost(title, content, user) {
    // TODO: Create a new post object and add to posts array
    // const newPost = {
    //     id: posts.length + 1,
    //     title,
    //     content,
    //     username: user.username,
    //     timestamp: new Date().toISOString(),
    //     likes: 0,
    // };
    // posts.push(newPost);
    // console.log(`Post titled "${title}" added by ${user.username}`);
    const timestamp = new Date().toISOString();

    try {
        await db.run(
            'INSERT INTO posts (title, content, username, timestamp, likes) VALUES (?, ?, ?, ?, ?)',
            [title, content, user.username, timestamp, 0]
        );
        console.log(`Post titled "${title}" added by ${user.username}`);
    } catch (error) {
        console.error('Error adding post to the database:', error);
    }

}

// Function to generate an image avatar
function generateAvatar(letter, width = 100, height = 100) {
    // TODO: Generate an avatar image with a letter
    // Steps:
    // 1. Choose a color scheme based on the letter
    // 2. Create a canvas with the specified width and height
    // 3. Draw the background color
    // 4. Draw the letter in the center
    // 5. Return the avatar as a PNG buffer
    // const { createCanvas } = require('canvas');

    // // Choose a color scheme based on the letter
    // const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A8', '#A833FF'];
    // const backgroundColor = colors[letter.charCodeAt(0) % colors.length];

    // // Create a canvas with the specified width and height
    // const canvas = createCanvas(width, height);
    // const context = canvas.getContext('2d');

    // // Draw the background color
    // context.fillStyle = backgroundColor;
    // context.fillRect(0, 0, width, height);

    // // Draw the letter in the center
    // context.fillStyle = '#fff';
    // context.font = 'bold 50px Arial';
    // context.textAlign = 'center';
    // context.textBaseline = 'middle';
    // context.fillText(letter, width / 2, height / 2);

    // // Return the avatar as a PNG buffer
    // return canvas.toBuffer('image/png');
    const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A8', '#A833FF'];
    const backgroundColor = colors[letter.charCodeAt(0) % colors.length];

    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');

    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);

    context.fillStyle = '#fff';
    context.font = 'bold 50px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(letter, width / 2, height / 2);

    return canvas.toBuffer('image/png');
}
