const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');

// Placeholder for the database file name
const dbFileName = 'microblog.db';

async function initializeDB() {
    const db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            hashedGoogleId TEXT NOT NULL UNIQUE,
            avatar_url TEXT,
            memberSince DATETIME NOT NULL
        );

        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            username TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            likes INTEGER NOT NULL,
            game TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS likes (
            username TEXT NOT NULL,
            post_id INTEGER NOT NULL,
            PRIMARY KEY (username, post_id)
        );
    `);

    // Sample data
    const users = [
        { username: 'user1', hashedGoogleId: 'hashedGoogleId1', avatar_url: '', memberSince: '2024-01-01 12:00:00' },
        { username: 'user2', hashedGoogleId: 'hashedGoogleId2', avatar_url: '', memberSince: '2024-01-02 12:00:00' },
        { username: 'gamerDude', hashedGoogleId: 'hashedGoogleId3', avatar_url: '', memberSince: '2024-01-03 12:00:00' },
        { username: 'proGamer', hashedGoogleId: 'hashedGoogleId4', avatar_url: '', memberSince: '2024-01-04 12:00:00' },
        { username: 'linkLover', hashedGoogleId: 'hashedGoogleId5', avatar_url: '', memberSince: '2024-01-05 12:00:00' },
        { username: 'zeldaFan', hashedGoogleId: 'hashedGoogleId6', avatar_url: '', memberSince: '2024-01-06 12:00:00' }
    ];

    const posts = [
        { title: 'Exploring the Mountains 🏔️', content: 'Just got back from a weekend trip to the mountains. The view was breathtaking and the fresh air was invigorating. Highly recommend! 🌲', username: 'user1', timestamp: '2024-01-01 12:30:00', likes: 0, game: 'General' },
        { title: 'New Coffee Shop in Town ☕', content: 'Discovered a new coffee shop downtown. The ambiance is perfect for working or just relaxing with a good book. The cappuccino was top-notch! 📚', username: 'user1', timestamp: '2024-01-03 14:15:00', likes: 0, game: 'General' },
        { title: 'Homemade Pizza Night 🍕', content: 'Tried making pizza from scratch last night. It turned out amazing! Might have found my new favorite hobby. 🍴', username: 'user2', timestamp: '2024-01-05 18:45:00', likes: 0, game: 'General' },
        { title: 'Sunday Morning Run 🏃', content: 'Went for a run in the park this morning. The weather was perfect and the birds were singing. Feeling refreshed and ready to tackle the week! 🏞️', username: 'user2', timestamp: '2024-01-07 09:30:00', likes: 0, game: 'General' },
        { title: 'CS2 Rank Up 🥇', content: 'Finally ranked up in CS2! My teammates actually used their mics and we coordinated like pros. Almost spilled my drink during a clutch moment! 🎮', username: 'gamerDude', timestamp: '2024-02-01 10:15:00', likes: 0, game: 'CS2' },
        { title: 'Zelda: Breath of the Wild Adventures 🗡️', content: 'Spent hours exploring the vast world of Zelda: Breath of the Wild. Found a hidden shrine and got a cool new weapon. Also, accidentally set a field on fire. Oops! 🔥', username: 'linkLover', timestamp: '2024-02-05 15:00:00', likes: 0, game: 'Zelda' },
        { title: 'Baldur\'s Gate 3: Epic Campaign 🛡️', content: 'Our D&D group started a campaign in Baldur\'s Gate 3. My character, a bard, managed to talk our way out of a fight. Then promptly fell into a trap. Classic. 🎲', username: 'zeldaFan', timestamp: '2024-02-07 21:30:00', likes: 0, game: 'BaldursGate' },
        { title: 'Evening Yoga Session 🧘', content: 'Had a relaxing yoga session in the evening. The perfect way to unwind and stretch after a long day. Namaste! 🕉️', username: 'user1', timestamp: '2024-02-09 20:00:00', likes: 0, game: 'General' },
        { title: 'Valorant: Ace of the Day 🏆', content: 'Pulled off an ace in Valorant today. The enemy team must’ve thought they were playing against aimbots. My team showered me with praise… and also asked if I could do it again. 😆', username: 'proGamer', timestamp: '2024-02-03 18:45:00', likes: 0, game: 'Valorant' },
        { title: 'Spring Cleaning 🧹', content: 'Spent the day doing some spring cleaning. The house feels so much more organized now. Time to relax and enjoy the clean space! 🏠', username: 'user2', timestamp: '2024-02-10 14:00:00', likes: 0, game: 'General' }
    ];

    // Insert sample data into the database
    await Promise.all(users.map(user => {
        return db.run(
            'INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)',
            [user.username, user.hashedGoogleId, user.avatar_url, user.memberSince]
        );
    }));

    await Promise.all(posts.map(post => {
        return db.run(
            'INSERT INTO posts (title, content, username, timestamp, likes, game) VALUES (?, ?, ?, ?, ?, ?)',
            [post.title, post.content, post.username, post.timestamp, post.likes, post.game]
        );
    }));

    console.log('Database populated with initial data.');
    await db.close();
}

initializeDB().catch(err => {
    console.error('Error initializing database:', err);
});
