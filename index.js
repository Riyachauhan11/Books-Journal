import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";

dotenv.config();
const { Pool } = pg;
const app = express();
const port = 3000;


const db = new Pool({
    connectionString: process.env.DBConfigLink,
    ssl: {
        rejectUnauthorized: false
    }
});
db.connect();

//const db = new pg.Client({
//  user: "postgres",
//  host: "localhost",
//  database: "books",
 // password: "roastedbeans",
//  port: 5432,
//});
//db.connect();

const API_URL = "https://www.googleapis.com/books/v1/volumes?q=isbn:";

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

var books_arr=[];

async function getBooks(){
  try{
    const result = await db.query("SELECT isbn, title, author, img, to_char(date_read, 'Mon dd, yyyy') as date_read, rating, review FROM book")
    return result.rows;
  }
  catch(err){
    console.log(err);
  }
}

async function getBooksTitle(){
  try{
    const result = await db.query("SELECT isbn, title, author,img, to_char(date_read, 'Mon dd, yyyy') as date_read, rating, review FROM book ORDER BY title ASC;")
    return result.rows;
  }
  catch(err){
    console.log(err);
  }
}

async function getBooksNewest(){
  try{
    const result = await db.query("SELECT isbn, title, author,img, to_char(date_read, 'Mon dd, yyyy') as date_read, rating, review FROM book ORDER BY date_read ASC;")
    return result.rows;
  }
  catch(err){
    console.log(err);
  }
}

async function getBooksRating(){
  try{
    const result = await db.query("SELECT isbn, title, author,img, to_char(date_read, 'Mon dd, yyyy') as date_read, rating, review FROM book ORDER BY rating DESC;")
    return result.rows;
  }
  catch(err){
    console.log(err);
  }
}

async function fetchBookByISBN(isbn){
  try{
    const result = await db.query("SELECT isbn, to_char(date_read, 'YYYY-MM-DD') as date_read, rating, review FROM book WHERE isbn=$1",[isbn])
    return result.rows;
  }
  catch(err){
    console.log(err);
  }
}

app.get("/", async(req, res) => {
  try{
    books_arr=await getBooks();
    //console.log(books_arr)
    res.render("index.ejs", { books: books_arr});   
  }
  catch(err){
    console.error("Failed to make request:", error.message);
    res.render("index.ejs", {
      error: error.message,
    });
  }
});


app.get("/title", async(req, res) => {
  try{
    books_arr=await getBooksTitle();
    //console.log(books_arr)
    res.render("index.ejs", { books: books_arr});   
  }
  catch(err){
    console.error("Failed to make request:", error.message);
    res.render("index.ejs", {
      error: error.message,
    });
  }
});

app.get("/newest", async(req, res) => {
  try{
    books_arr=await getBooksNewest();
    res.render("index.ejs", { books: books_arr});   
  }
  catch(err){
    console.error("Failed to make request:", error.message);
    res.render("index.ejs", {
      error: error.message,
    });
  }
});

app.get("/rating", async(req, res) => {
  try{
    books_arr=await getBooksRating();
    //console.log(books_arr)
    res.render("index.ejs", { books: books_arr});   
  }
  catch(err){
    console.error("Failed to make request:", error.message);
    res.render("index.ejs", {
      error: error.message,
    });
  }
});

app.get("/add_new_book", async (req, res) => {
  try {
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
    const book_details = await fetchBookByISBN(isbn);
    res.render("edit_book.ejs",{book_details:book_details[0]});
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
  try{
    var ISBN = req.body["ISBN"];
    let charToRemove = "-"; 
    let charToRemove2 = " ";
    let regex = new RegExp(charToRemove, 'g'); 
    let regex2 = new RegExp(charToRemove2,'g');
    ISBN = ISBN.replace(regex, ''); 
    ISBN = ISBN.replace(regex2,'');
    let isnum = /^\d+$/.test(ISBN);
    console.log(ISBN)
    console.log(ISBN.length)
    console.log(isnum)
    if ((ISBN.length!=13 || ISBN.length!=10) && isnum==false){
      const stmt1="Invalid ISBN. The International Standard Book Number (ISBN) needs to be a 13-digit or 10-digit number (no alphabetic characters) that uniquely identifies real books internationally."
      res.render("add_new_book.ejs", {
        wrong_isbn:stmt1,     
      });
    }
    else{
      const response = await axios.get(API_URL+ISBN);
      const result = response.data;
      //console.log(result);
      const count_Book_Fetched=result.totalItems
      if (count_Book_Fetched==0){
        const stmt2="ISBN doesn't match to a book or you might need to enter a different ISBN of the same book. There is a possibility that the book can't be currently fetched but kindly check with available ISBN's first."
        res.render("add_new_book.ejs", {
          isbn_err:stmt2,     
        });
      }
      const book = result.items[0].volumeInfo
      console.log(book);
      
      var author = book.authors
      var title = book.title
      console.log(title);
      console.log(author);
      var date_read = req.body.date_read
      var rating =req.body.rating
      var review = req.body.review
      var authors=""

      if ((review.length<50) || (review.length>2000)){
        const stmt3="Review is either too short or too long. Change it accordingly."
        res.render("add_new_book.ejs", {
          review_err:stmt3,     
        });
      }
      else{
  
        if (book.hasOwnProperty("imageLinks")){
          var img = book.imageLinks.thumbnail
        }
        else{
          var img="https://i.ibb.co/mv9RTYZ/J5-LVHEL-2.jpg"
        }

        if (author===undefined){
          authors="—";
        }
        else{
          for (let i=0; i<author.length;i++){
          authors+=author[i] + ", "
        }
        }

        authors=authors.slice(0,authors.length-2)
        await db.query("INSERT INTO book (isbn,title,author,img,date_read,rating,review) VALUES ($1,$2,$3,$4,$5,$6,$7);",
        [ISBN,title,authors,img,date_read,rating,review]);
        res.redirect("/");
        }
      }

  }
  catch(err){
    console.log(err);
    if (err.constraint=="book_pkey"){
      const stmt3="Book is already present in the list."
      res.render("add_new_book.ejs", {
        repeated_entry:stmt3,     
      });
    }
    else if (err.constraint=="unique_title_author"){
      const stmt4="Book is already present in the list."
      res.render("add_new_book.ejs", {
        repeated_entry:stmt4,     
      });      
    }
  }
});

app.post("/edit_book", async(req, res) => {
  const isbn_editedBook = req.query.isbn;
  let updated_dateRead = req.body["updated_dateRead"];
  let updated_rating = req.body["updated_rating"];
  let updated_review= req.body["updated_review"];
  console.log(updated_dateRead)
  console.log(isbn_editedBook)
  try{
    await db.query("UPDATE book SET date_read=$1,rating=$2,review=$3 WHERE isbn=$4;",[updated_dateRead,updated_rating,updated_review,isbn_editedBook]);
    res.redirect("/");
  }
  catch(err){
    console.log(err);
  }

});

app.post("/delete_book", async(req, res) => {
  const isbn_deletedBook = req.query.isbn;
  console.log(isbn_deletedBook)
  try{
    await db.query("DELETE FROM book where isbn=$1;",[isbn_deletedBook]);
    res.redirect("/");
  }
  catch(err){
    console.log(err);
  }
  
});


app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
