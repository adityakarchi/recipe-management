const mysql = require('mysql2');

// Create a connection
const connection = mysql.createConnection({
  host: 'localhost//127.0.0.1',      // or your server IP
  user: 'aditya',   // e.g., 'root'
  password: 'aditya1234',
  database: 'recipe_db',
});

// Connect to MySQL
connection.connect((err) => {
  if (err) {
    console.error('Connection error:', err.message);
    return;
  }
  console.log('Connected to MySQL database!');
});

// Sample Query
connection.query('SELECT * FROM your_table_name', (err, results) => {
  if (err) {
    console.error('Query error:', err.message);
    return;
  }
  console.log(results); // Show the fetched rows
});

// Close the connection (optional)
connection.end();
