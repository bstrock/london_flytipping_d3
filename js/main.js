
// define promises as d3 method objects
const promises = [d3.json('data/london_boroughs.json'), d3.json("data/london_centres.json")];

// pass method objects to Promise constructor
dataPromises = Promise.all(promises);

// call promises, construct datasets object, pass to map generation function
dataPromises.then(function(data) {
  const datasets = {
    boroughs: data[0],
    centres: data[1]
  };

    console.log(datasets);
    generateMap(datasets);

});

// in case of error
dataPromises.catch(function(){
  console.log("Promises not kept.")
});

var generateMap = function(datasets) {

  let width = 1200,
    height = 800;

  let projection = d3.geoBonne() // because
    .center([-.11, 51.51]) // london, uk
    .scale(115000) // big number
    .translate([width / 2, (height / 2) - height * .05]); // centers the map w/ 5% vertical offset

  let svg = d3.select('body').append('svg') // create svg element
    .attr('class', 'map') // define class
    .attr('width', width) // assign width
    .attr('height', height); // assign height

  let path = d3.geoPath() // define geopath generator
    .projection(projection); // asssign projection

  svg.selectAll('path') // create path object placeholders
    .attr('class', 'borough') // assign class
    .data(topojson.feature(datasets.boroughs, datasets.boroughs.objects.london_boroughs).features) // feed d3
    .enter() // enter topology array
    .append('path') // append path to svg
    .attr('d', path) // assign path data to svg path
    .style('fill', 'black') // classy night time fill
    .style('stroke', 'white') // classy night time outlines
    .style('stroke-width', '.25px'); // really really classy outlines

    svg.selectAll('path')  // create path object placeholders
    .attr('class', 'centre')  // assign class
    .data(topojson.feature(datasets.centres, datasets.centres.objects.london_centres).features)  // feed d3
    .enter()  // enter topology array
    .append('path')  // append path to svg
    .attr('d', path);  // assign path data to svg path


};
