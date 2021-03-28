
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

  attArray = Object.keys(datasets.floorspace[0]); // list of attributes

  let expressed = attArray[3]; // initial choropleth expressed

  generateMap(datasets);

});

// in case of error
dataPromises.catch(function(){
  console.log("Promises not kept.")
});

var generateMap = function(datasets, attArray) {

  let width = 1200,
    height = 800;

  const projection = d3.geoBonne() // because
    .center([-.11, 51.51]) // london, uk
    .scale(115000) // big number
    .translate([width / 2, (height / 2) - height * .05]); // centers the map w/ 5% vertical offset

  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on('zoom', function(e){
      map.selectAll('path')
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

  addCentres(map, path, centresGeoJSON, attributes); // attach centres to svg

};

var colorScaler = function(map, attributes){

  const colors = [colorbrewer.BuGn['5'],
                colorbrewer.OrRd['5'],
                colorbrewer.PuBuGn['5'],
                colorbrewer.RdPu['5'],
                colorbrewer.Blues['5'],
                colorbrewer.Oranges['5'],
                colorbrewer.PuRd['5'],
                colorbrewer.Greens['5'],
                colorbrewer.YlOrBr['5']
                ];

  let colorScales = {};

  for (let i = 0; i < attArray.length; i++){  // loop through attributes

    let att = attArray[i];  // makes it easier to read

    colorScales[att] = {
      values: [],
      domain: [],
      scale: null
    };  // placeholder for attribute

    for (let row = 0; row < attributes.length; row++){  // loop through town centres
      let val = attributes[row][att];  // this is either a float or a string
      if (val >= 0){  // if its a float
        colorScales[att].values.push(val);  // it goes in the array
      } else {  // if not
        delete colorScales[att];  // bye bye
        break  // strings don't need this next bit
      }

      colorScales[att].domain = [d3.min(colorScales[att].values), d3.max(colorScales[att].values)];  // here's the domain for this attribute
    }
  }

  let colorKeys = Object.keys(colorScales);  // we only want numerical values from here on out

  for (let i = 0; i < colorKeys.length; i++) {  // loop through attributes
    let att = colorKeys[i];  // capture attribute
    let clusters = ss.ckmeans(colorScales[att].values, 5);  // determine attribute value clusters
    let breaks = [];  // break values stored here
    for (let j = 0; j < clusters.length; j++){  // loop through clusters
      breaks.push(d3.min(clusters[j]))  // add cluster min to breaks
    }
    breaks.shift();  // drop first value to create 4 breakpoints

    // at last.
    // this block creates a color scale with a unique color for each numerical attribute
    // colorScales[att].scale(x) will always return a hex color value!
    colorScales[att].scale = d3.scaleThreshold()
                                .range(colors[i])
                                .domain(breaks);


  }
  return colorScales;
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

var addCentres = function(map, path, centresGeoJSON, attributes){

  // in converting attribute value to color value via color scale, each areal unit has a possible colorspace of (in
  // this case) 9 values.  In order to provide convenient and efficient color switching, we'll simply use the color
  // scales object created in colorize() to define an object which contains the color value of each attribute
  // for each town centre.  This will be called by .style() when the attribute selector radio button changes state.

  let colorScales = colorScaler(map, attributes);

  let colorKeys = Object.keys(colorScales);  // we only want numerical values from here on out

  function MyColors(attVals){
    for (let i = 0; i < colorKeys.length; i++){
      let att = colorKeys[i];

      let val = attVals[att];
      let scale = (colorScales[att].scale);
      this[att] = scale(val);
      }
    }

  map.selectAll('path')  // create path object placeholders
    .attr('class', 'centre')  // assign class
    .data(centresGeoJSON)  // feed d3
    .enter()  // enter topology array
    .append('path')  // append path to svg
    .attr('d', path) // assign path data to svg path
    .attr('id', function(d){
      return d.properties.sitename  // tag sitename to path
  })
    .attr('myColors', function(){
      let attVals = {};
      let id = this.id;
      for (let i = 0; i < colorKeys.length; i++) {
        let att = colorKeys[i];
        for (let row = 0; row < attributes.length; row++){
          if (attributes[row].town_centre === id){
            attVals[att] = attributes[row][att]
          }
        }
      }
      let myColors = new MyColors(attVals);
      return (myColors)


      })
};
