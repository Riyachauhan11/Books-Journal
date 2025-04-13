import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth2";
import axios from "axios";
import pg from "pg";

dotenv.config();
const { Pool } = pg;
const app = express();
const port = 3000;

//const db = new Pool({
//    connectionString: process.env.DBConfigLink,
//    ssl: {
//        rejectUnauthorized: false
//    }
//});
//db.connect();

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

const API_URL = "https://www.googleapis.com/books/v1/volumes?q=isbn:";

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async function (accessToken, refreshToken, profile, done) {
      try {
        const email = profile.emails[0].value;
        const result = await db.query("SELECT * FROM users WHERE email=$1", [
          email,
        ]);

        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (email) VALUES ($1) RETURNING *",
            [email]
          );
          return done(null, newUser.rows[0]);
        } else {
          return done(null, result.rows[0]);
        }
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id); // store user ID in session
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id=$1", [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err);
  }
});

var books_arr = [];

async function getBooks(userId) {
  try {
    const result = await db.query(
      "SELECT isbn, title, author, img, to_char(date_read, 'Mon dd, yyyy') as date_read, rating, review FROM book WHERE user_id = $1",
      [userId]
    );
    return result.rows;
  } catch (err) {
    console.log(err);
  }
}

async function getBooksTitle(userId) {
  try {
    const result = await db.query(
      "SELECT isbn, title, author,img, to_char(date_read, 'Mon dd, yyyy') as date_read, rating, review FROM book WHERE user_id = $1 ORDER BY title ASC;",
      [userId]
    );
    return result.rows;
  } catch (err) {
    console.log(err);
  }
}

async function getBooksNewest(userId) {
  try {
    const result = await db.query(
      "SELECT isbn, title, author,img, to_char(date_read, 'Mon dd, yyyy') as date_read, rating, review FROM book WHERE user_id = $1 ORDER BY date_read ASC;",
      [userId]
    );
    return result.rows;
  } catch (err) {
    console.log(err);
  }
}

async function getBooksRating(userId) {
  try {
    const result = await db.query(
      "SELECT isbn, title, author,img, to_char(date_read, 'Mon dd, yyyy') as date_read, rating, review FROM book WHERE user_id = $1 ORDER BY rating DESC;",
      [userId]
    );
    return result.rows;
  } catch (err) {
    console.log(err);
  }
}

async function fetchBookByISBN(isbn, userId) {
  try {
    const result = await db.query(
      "SELECT isbn, to_char(date_read, 'YYYY-MM-DD') as date_read, rating, review FROM book WHERE isbn=$1 AND user_id=$2",
      [isbn, userId]
    );
    return result.rows;
  } catch (err) {
    console.log(err);
  }
}

app.get("/", async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    books_arr = await getBooks(userId);
    res.render("index.ejs", { books: books_arr, user: req.user });
  } catch (err) {
    console.error("Failed to make request:", err.message);
    res.render("index.ejs", {
      error: err.message,
    });
  }
});

app.get("/title", async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    books_arr = await getBooksTitle(userId);
    res.render("index.ejs", { books: books_arr, user: req.user });
  } catch (err) {
    console.error("Failed to make request:", err.message);
    res.render("index.ejs", {
      error: err.message,
    });
  }
});

app.get("/newest", async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    books_arr = await getBooksNewest(userId);
    res.render("index.ejs", { books: books_arr, user: req.user });
  } catch (err) {
    console.error("Failed to make request:", err.message);
    res.render("index.ejs", {
      error: err.message,
    });
  }
});

app.get("/rating", async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    books_arr = await getBooksRating(userId);
    res.render("index.ejs", { books: books_arr, user: req.user });
  } catch (err) {
    console.error("Failed to make request:", err.message);
    res.render("index.ejs", {
      error: err.message,
    });
  }
});

app.get("/add_new_book", async (req, res) => {
  try {
    if (!req.user) return res.redirect("/auth/google");
    res.render("add_new_book.ejs");
  } catch (error) {
    console.error("Failed to make request:", error.message);
    res.render("add_new_book.ejs", {
      error: error.message,
    });
  }
});

app.get("/edit_book", async (req, res) => {
  try {
    const isbn = req.query.isbn;
    const book_details = await fetchBookByISBN(isbn, req.user.id);
    res.render("edit_book.ejs", { book_details: book_details[0] });
  } catch (error) {
    console.error("Failed to make request:", error.message);
    res.render("edit_book.ejs", {
      error: error.message,
    });
  }
});

app.get("/resources", async (req, res) => {
  try {
    res.render("resources.ejs");
  } catch (error) {
    console.error("Failed to make request:", error.message);
    res.render("resources.ejs", {
      error: error.message,
    });
  }
});

app.get("/about", async (req, res) => {
  try {
    res.render("about.ejs");
  } catch (error) {
    console.error("Failed to make request:", error.message);
    res.render("about.ejs", {
      error: error.message,
    });
  }
});

app.post("/add_new_book", async (req, res) => {
  try {
    var ISBN = req.body["ISBN"];
    let charToRemove = "-";
    let charToRemove2 = " ";
    let regex = new RegExp(charToRemove, "g");
    let regex2 = new RegExp(charToRemove2, "g");
    ISBN = ISBN.replace(regex, "");
    ISBN = ISBN.replace(regex2, "");
    let isnum = /^\d+$/.test(ISBN);
    // console.log(ISBN);
    // console.log(ISBN.length);
    // console.log(isnum);
    if ((ISBN.length != 13 || ISBN.length != 10) && isnum == false) {
      const stmt1 =
        "Invalid ISBN. The International Standard Book Number (ISBN) needs to be a 13-digit or 10-digit number (no alphabetic characters) that uniquely identifies real books internationally.";
      res.render("add_new_book.ejs", {
        wrong_isbn: stmt1,
      });
    } else {
      const response = await axios.get(API_URL + ISBN);
      const result = response.data;
      //console.log(result);
      const count_Book_Fetched = result.totalItems;
      if (count_Book_Fetched == 0) {
        const stmt2 =
          "ISBN doesn't match to a book or you might need to enter a different ISBN of the same book. There is a possibility that the book can't be currently fetched but kindly check with available ISBN's first.";
        res.render("add_new_book.ejs", {
          isbn_err: stmt2,
        });
      }
      const book = result.items[0].volumeInfo;

      var author = book.authors;
      var title = book.title;
      var date_read = req.body.date_read;
      var rating = req.body.rating;
      var review = req.body.review;
      var authors = "";

      if (review.length < 50 || review.length > 2000) {
        const stmt3 =
          "Review is either too short or too long. Change it accordingly.";
        res.render("add_new_book.ejs", {
          review_err: stmt3,
        });
      } else {
        if (book.hasOwnProperty("imageLinks")) {
          var img = book.imageLinks.thumbnail;
        } else {
          var img = "https://i.ibb.co/mv9RTYZ/J5-LVHEL-2.jpg";
        }

        if (author === undefined) {
          authors = "—";
        } else {
          for (let i = 0; i < author.length; i++) {
            authors += author[i] + ", ";
          }
        }

        authors = authors.slice(0, authors.length - 2);
        await db.query(
          "INSERT INTO book (user_id, isbn, title, author, img, date_read, rating, review) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);",
          [req.user.id, ISBN, title, authors, img, date_read, rating, review]
        );
        res.redirect("/");
      }
    }
  } catch (err) {
    console.log(err);
    if (err.constraint == "book_pkey") {
      const stmt3 = "Book is already present in the list.";
      res.render("add_new_book.ejs", {
        repeated_entry: stmt3,
      });
    } else if (err.constraint == "unique_title_author") {
      const stmt4 = "Book is already present in the list.";
      res.render("add_new_book.ejs", {
        repeated_entry: stmt4,
      });
    }
  }
});

app.post("/edit_book", async (req, res) => {
  const isbn_editedBook = req.query.isbn;
  let updated_dateRead = req.body["updated_dateRead"];
  let updated_rating = req.body["updated_rating"];
  let updated_review = req.body["updated_review"];
  try {
    await db.query(
      "UPDATE book SET date_read=$1, rating=$2, review=$3 WHERE isbn=$4 AND user_id=$5;",
      [
        updated_dateRead,
        updated_rating,
        updated_review,
        isbn_editedBook,
        req.user.id,
      ]
    );
    res.redirect("/");
  } catch (err) {
    console.log(err);
  }
});

app.post("/delete_book", async (req, res) => {
  const isbn_deletedBook = req.query.isbn;
  // console.log(isbn_deletedBook);
  try {
    await db.query("DELETE FROM book WHERE isbn=$1 AND user_id=$2;", [
      isbn_deletedBook,
      req.user.id,
    ]);
    res.redirect("/");
  } catch (err) {
    console.log(err);
  }
});

// Start Google OAuth flow
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["email", "profile"],
  })
);

// Handle callback from Google
app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/",
    successRedirect: "/",
  })
);

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) console.error(err);
    res.redirect("/");
  });
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
