const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const canvas = require('canvas');
const { createCanvas } = require('canvas')

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;

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

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Home route: render home view with posts and user
// We pass the posts and user variables into the home
// template
//
app.get('/', (req, res) => {
    const posts = getPosts();
    const user = getCurrentUser(req) || {};
    res.render('home', { posts, user });
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


app.get('/post/:id', (req, res) => {
    // TODO: Render post detail page
});
app.post('/posts', (req, res) => {
    // TODO: Add a new post and redirect to home
    const { title, content } = req.body;
    const user = getCurrentUser(req);
    if (!user) {
        return res.redirect('/login');
    }
    addPost(title, content, user);
    res.redirect('/');
});
app.post('/like/:id', (req, res) => {
    // TODO: Update post likes
    const postId = parseInt(req.params.id, 10);
    const post = posts.find(p => p.id === postId);
    if (post) {
        post.likes += 1;
    }
    res.redirect('/');
});
app.get('/profile', isAuthenticated, (req, res) => {
    // TODO: Render profile page
    const user = getCurrentUser(req);
    if (!user) {
        return res.redirect('/login');
    }

    const userPosts = posts.filter(post => post.username === user.username);
    res.render('profile', { user, posts: userPosts });
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
app.post('/register', (req, res) => {
    // TODO: Register a new user
    const { username } = req.body;
    console.log(`Attempting to register user: ${username}`);

    if (findUserByUsername(username)) {
        console.log(`Registration failed: Username ${username} already exists`);
        return res.redirect('/register?error=Username already exists');
    }

    addUser(username);
    const user = findUserByUsername(username);
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
app.post('/login', (req, res) => {
    // TODO: Login a user
    const { username } = req.body;
    console.log(`Attempting to log in user: ${username}`);

    const user = findUserByUsername(username);
    if (!user) {
        console.log(`Login failed: Invalid username ${username}`);
        return res.redirect('/login?error=Invalid username');
    }

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
app.post('/delete/:id', isAuthenticated, (req, res) => {
    // TODO: Delete a post if the current user is the owner
    const postId = parseInt(req.params.id, 10); 
    // remove the post from the posts array
    posts = posts.filter(post => post.id !== postId);
    console.log(`Post with ID ${postId} deleted`);
    res.redirect('/');
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.listen(PORT, () => {
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
function findUserByUsername(username) {
    // TODO: Return user object if found, otherwise return undefined
    return users.find(user => user.username === username);
}

// Function to find a user by user ID
function findUserById(userId) {
    // TODO: Return user object if found, otherwise return undefined
    return users.find(user => user.id === userId);
}

// Function to add a new user
function addUser(username) {
    // TODO: Create a new user object and add to users array
    const newUser = {
        id: users.length + 1,
        username,
        avatar_url: undefined,
        memberSince: new Date().toISOString(),
    };
    users.push(newUser);
    console.log(`User ${username} added with ID ${newUser.id}`);
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
function getCurrentUser(req) {
    // TODO: Return the user object if the session user ID matches
    return findUserById(req.session.userId);
}

// Function to get all posts, sorted by latest first
function getPosts() {
    return posts.slice().reverse();
}

// Function to add a new post
function addPost(title, content, user) {
    // TODO: Create a new post object and add to posts array
    const newPost = {
        id: posts.length + 1,
        title,
        content,
        username: user.username,
        timestamp: new Date().toISOString(),
        likes: 0,
    };
    posts.push(newPost);
    console.log(`Post titled "${title}" added by ${user.username}`);
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
    const { createCanvas } = require('canvas');

    // Choose a color scheme based on the letter
    const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A8', '#A833FF'];
    const backgroundColor = colors[letter.charCodeAt(0) % colors.length];

    // Create a canvas with the specified width and height
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');

    // Draw the background color
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);

    // Draw the letter in the center
    context.fillStyle = '#fff';
    context.font = 'bold 50px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(letter, width / 2, height / 2);

    // Return the avatar as a PNG buffer
    return canvas.toBuffer('image/png');
}