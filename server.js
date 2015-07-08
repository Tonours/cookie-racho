var express = require('express');
var fs      = require('fs');
var slug    = require('slug');
var app     = express();
var xray    = require('x-ray');

app.get('/', function(req, res){
  res.send("Don't forget to add your recipe name after / ");
});

app.get('/:name', function(req, res){

	// get name, decodeURI and slugify it
	var search = slug(decodeURI(req.params.name));

	url = 'http://www.marmiton.org/recettes/recherche.aspx?s='+search+'&type=all';
	
	xray(url)
	  .select([{
	    $root: '.m_item.recette_classique',
	    title: '.m_titre_resultat a',
	    link: '.m_titre_resultat a[href]',
	    description: '.m_texte_resultat',
	  }])
	  .paginate('.m_resultat_pagination_lien a[href]')
	  .limit(2)
	  .run(function(err, data) {
	    res.writeHead(200, { 'Content-Type': 'application/json' });
   		res.write(JSON.stringify(data));
   		res.end();
	  });
	
});

app.listen('9000')
console.log('Magic happens on port 9000');
exports = module.exports = app; 	