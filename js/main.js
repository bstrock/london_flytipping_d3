
// define promises as d3 method objects
const promises = [d3.json('data/london_boroughs.json'), d3.json("data/london_centres.json"), d3.csv('data/london_nte_floorspace.csv')];

// pass method objects to Promise constructor
const dataPromises = Promise.all(promises);

// call promises, construct datasets object, pass to map generation function
dataPromises.then(function(data) {
  const datasets = {
    boroughs: data[0],
    centres: data[1],
    floorspace: data[2]
  };

  generateMap(datasets);

});

// in case of error
dataPromises.catch(function(){
  console.log("Promises not kept.")
});

var generateMap = function(datasets) {

  let width = 1200,
    height = 800;

  const projection = d3.geoBonne() // because
    .center([-.11, 51.51]) // london, uk
    .scale(115000) // big number
    .translate([width / 2, (height / 2) - height * .05]); // centers the map w/ 5% vertical offset

  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on('zoom', function(e){
      svg.selectAll('path')
        .attr('transform', e.transform);
    });

  const path = d3.geoPath() // define geopath generator
    .projection(projection); // asssign projection

  let map = d3.select('body').append('svg') // create svg element
    .attr('class', 'map') // define class
    .attr('width', width) // assign width
    .attr('height', height); // assign height

  map.call(zoom);

  let boroughsGeoJSON = topojson.feature(datasets.boroughs, datasets.boroughs.objects.london_boroughs).features;
  let centresGeoJSON = topojson.feature(datasets.centres, datasets.centres.objects.london_centres).features;
  let attributes = datasets.floorspace;

  dataJoin(centresGeoJSON, attributes); // get those attributes where they belong

  addBoroughs(map, path, boroughsGeoJSON); // attach boroughs to svg

  addCentres(map, path, centresGeoJSON); // attach centres to svg

  colorize(attributes)

};

var colorize = function(attributes){

};

var dataJoin = function(geodata, attributes){

  // pandas for javascript, anyone? ^_^

  // is it a triple-loop?  it's a triple-loop.  Here we go.

  for (let i = 0; i < geodata.length; i++){  // start with geojson items
    let key = geodata[i].properties.sitename;  // town centre sitename is key
    for (let j = 0; j < attributes.length; j++){ // check against attributes array
      let lock = attributes[j].town_centre;  // find matching row name in csv data

      if (key === lock){  // a match!
        let centre = geodata[i].properties;  // attribute values will be assigned to this
        const data = attributes[j];  // individual row/col pairs

        for (let att in data){ // loop over attributes
          const val = data[att]; // assign value to check whether text or number

          // this is the join- it's also a type function to separately parse floats to avoid converting strings to NaN
          if (val >= 0) {
            centre[att] = parseFloat(val)
          } else {
            centre[att] = val;
          }
        }
      }
    }
  }
};

var addBoroughs = function(map, path, boroughsGeoJSON){

  map.selectAll('path') // create path object placeholders
    .attr('class', 'borough') // assign class
    .data(boroughsGeoJSON) // feed d3
    .enter() // enter topology array
    .append('path') // append path to svg
    .attr('d', path) // assign path data to svg path
    .attr('id', function(d){
      return d.properties.NAME // tag name to path
    })
    .style('fill', 'black') // classy night time fill
    .style('stroke', 'white') // classy night time outlines
    .style('stroke-width', '.25px'); // really really classy outlines
};

var addCentres = function(map, path, centresGeoJSON){

  map.selectAll('path')  // create path object placeholders
    .attr('class', 'centre')  // assign class
    .data(centresGeoJSON)  // feed d3
    .enter()  // enter topology array
    .append('path')  // append path to svg
    .attr('d', path) // assign path data to svg path
    .attr('id', function(d){
      return d.properties.sitename  // tag sitename to path
  });
};
