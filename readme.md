# Cookie Racho

## What is cookie Racho

Cookie racho is not a super villain cookie thief.

Cookie racho is a simple node.js based crawler to scrap recipes from marmiton.org based on a recipe name.

## What do you need...

You need to have [Node.js](https://nodejs.org/) installed.

## Installation

    git clone <this-repo>
    cd cookie-racho
    npm install
    node server.js


## Usage

    Open your browser
    Go to http://localhost:9000/<recipe-name> (e.g: http://localhost:9000/cookies)
    Tadam you have all results about your recipe in json

## Page limits

    If you want, you can increase number of results pages to crawl by editing this line in server.js :

      .limit(2) 
