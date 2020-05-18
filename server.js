
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const fs = require("fs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static("public"));

// lol
const username = 'ADMIN'
const password = 'ADMIN'

// init sqlite db
const dbFile = "./.data/sqlite.db";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(dbFile);

// super insecure, but does not matter yet
// this is a temporary sqlite db
app.post('/sql', async (request, response) => {
  
    const { sql, values } = request.body
    new Promise( (Y,N) => db.all(sql, values, (err,data) => err ? N(err) : Y(data) ))
      .then(
        x => response.send(x)
      )
      .catch( e => {
        console.error(e)
        response.status(500)
        response.send({ message: e.message });
      })
})


app.use(function (req, res, next) {
  res.sendFile(`${__dirname}/views/index.html`);
})

// listen for requests :)
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});