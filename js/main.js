
// define promises as d3 method objects
const promises = [d3.json('data/london_boroughs.json'), d3.csv('data/fly-tipping-borough.csv')];

// pass method objects to Promise constructor
const dataPromises = Promise.all(promises);

var domains = {}; // this will hold our domains



// call promises, construct datasets object, pass to map generation function
dataPromises.then(function(data) {
  console.log(data);
  const datasets = {
    boroughs: data[0],
    flyTipping: data[1]
  };

  attArray = Object.keys(datasets.flyTipping[0]); // list of attributes
  attArray.slice(2);

  generateMap(datasets);

});

// in case of error
dataPromises.catch(function(){
  console.log("Promises not kept.")
});

var generateMap = function(datasets) {

  let width = window.innerWidth * .65,
    height = 800;

  const projection = d3.geoBonne() // because
    .center([-.11, 51.51]) // london, uk
    .scale(112000) // big number
    .translate([width / 2, (height / 2) - height * .05]); // centers the map w/ 5% vertical offset

  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on('zoom', function(e){
      map.selectAll('path')
        .attr('transform', e.transform);
    });

  const path = d3.geoPath() // define geopath generator
    .projection(projection); // asssign projection

  let map = d3.select('#map-container').append('svg') // create svg element
    .attr('class', 'map') // define class
    .attr('width', width) // assign width
    .attr('height', height) // assign height
    .style('background-color', 'black');

  map.call(zoom);
  let boroughsGeoJSON = topojson.feature(datasets.boroughs, datasets.boroughs.objects.London_Borough_Excluding_MHW).features;
  let attributes = datasets.flyTipping;

  dataJoin(boroughsGeoJSON, attributes); // get those attributes where they belong

  addBoroughs(map, path, boroughsGeoJSON, attributes); // attach centres to svg

  addRadioButtons(map);

  chartFactory(map, attributes);

};

var colorScaler = function(map, attributes){

  const colors = [colorbrewer.BuGn['5'],
                colorbrewer.OrRd['5'],
                colorbrewer.PuBuGn['5'],
                colorbrewer.RdPu['5'],
                colorbrewer.Blues['5'],
                colorbrewer.Oranges['5'],
                colorbrewer.PuRd['5'],
                colorbrewer.YlOrBr['5'],
                colorbrewer.GnBu['5']
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

      let domain = [d3.min(colorScales[att].values), d3.max(colorScales[att].values)];  // here's the domain for this attribute
      colorScales[att].domain = domain;  // assign it to the colorscale
      domains[att] = domain; // assign it to the global to compute graphs

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

  console.log(attributes);

  // pandas for javascript, anyone? ^_^

  // is it a triple-loop?  it's a triple-loop.  Here we go.

  for (let i = 0; i < geodata.length; i++){  // start with geojson items
    let key = geodata[i].properties.NAME;  // town centre sitename is key
    for (let j = 0; j < attributes.length; j++){ // check against attributes array
      let lock = attributes[j].Area;  // find matching row name in csv data

      if (key === lock){  // a match!
        let borough = geodata[i].properties;  // attribute values will be assigned to this
        const data = attributes[j];  // individual row/col pairs

        for (let att in data){ // loop over attributes
          const val = data[att]; // assign value to check whether text or number

          // this is the join- it's also a type function to separately parse floats to avoid converting strings to NaN
          if (val >= 0) {
            borough[att] = parseFloat(val)
          } else {
            borough[att] = val;
          }
        }
      }
    }
  }
};


var addBoroughs = function(map, path, boroughsGeoJSON, attributes){

  // this is where the centre paths are created and added.  when they are added, they are also given a colorspace.
  // in converting attribute value to color value via color scale, each areal unit has a possible colorspace of (in
  // this case) 9 values.  In order to provide convenient and efficient color switching, we'll simply use the color
  // scales object created in colorize() to define an object which contains the color value of each attribute
  // for each town centre.  This will be called by .style() when the attribute selector radio button changes state.

  let colorScales = colorScaler(map, attributes);

  let colorKeys = Object.keys(colorScales);  // we only want numerical values from here on out

  // constructor function
  function MyColors(attVals){
    for (let i = 0; i < colorKeys.length; i++){
      let att = colorKeys[i];
      let val = attVals[att];
      let scale = (colorScales[att].scale);

      this[att] = scale(val);
      }
    }

  map.selectAll('path')  // create path object placeholders

    .data(boroughsGeoJSON)  // feed d3
    .enter()  // enter topology array
    .append('path')  // append path to svg
    .attr('d', path) // assign path data to svg path
    .attr('id', function(d){
      return d.properties.NAME  // tag sitename to path
  })
    .classed('borough', true)  // add class
    .property('myColors', function(){  // attach color library to path
      let attVals = {};  // placeholder object
      let id = this.id;  // store id
      for (let i = 0; i < colorKeys.length; i++) {  // iterate through numerical attributes
        let att = colorKeys[i];  // store attribute name
        for (let row = 0; row < attributes.length; row++){  // loop through town centres
          if (attributes[row].Area === id){  // match id to table row
            attVals[att] = attributes[row][att]; // append cell values to attribute values array
            if (att === "Change From Five Years Ago"){ // why is this here?
            }
          }
        }
      }
      let myColors = new MyColors(attVals);  // construct color library for this path from constructor

      return (myColors)  // send library to path
      })
    .style('fill', function(){
      // initial color
      return this.myColors[colorKeys[0]]

    })


};

var addRadioButtons = function(map) {
  // a click switches the radio button, then runs colorizer function on all boroughs for that attribute

  d3.selectAll('input')
    .on('click', function(){
      switch (this.value){
        case 'total':
          pathColorizer(map, 'Total Incidents');  // paths first, then bars
          barChanger(map);
          break;

        case 'actions':
          pathColorizer(map, 'Total Action Taken');
          barChanger(map);
          break;

        case 'letters':
          pathColorizer(map, 'Warning Letters');
          barChanger(map);
        break;

        case 'penalty':
          pathColorizer(map, 'Fixed Penalty Notices');
          barChanger(map);
          break;

        case 'statutory':
          pathColorizer(map, 'Statutory Notices');
          barChanger(map);
          break;

        case 'cautions':
          pathColorizer(map, 'Formal Cautions');
          barChanger(map);
        break;

        case 'prosecutions':
          pathColorizer(map, 'Prosecutions');
          barChanger(map);
          break;

        case 'change-one':
          pathColorizer(map, 'Change From Previous Year');
          barChanger(map);
          break;

        case 'change-five':
          pathColorizer(map, 'Change From Five Years Ago');
          barChanger(map);
          break;
      }
    })
};

let pathColorizer = function(map, attribute) {
  // when clicked, radio buttons cause boroughs to update their colors based on color dictionary

  let paths = map.selectAll('.borough');  // borough selection
  let bars = d3.selectAll(".bar");

  let pathArray = paths._groups[0]; // gets the boroughs

    for (let i = 0; i < pathArray.length; i++){
            let color = pathArray[i].myColors[attribute]; // grabs color from borough's dictionary
            pathArray[i].style = 'fill: ' + color;  // calls color value for attribute on borough
          }
};

let chartFactory = function (map, attributes) {
  // we're going to build a chart

  let chartVars = {
   width: window.innerWidth * .25,
        height: 400,
        leftPadding: 2,
        rightPadding: 20,
        topBottomPadding: 5
   };
       chartVars.innerWidth = chartVars.width - chartVars.leftPadding - chartVars.rightPadding;
       chartVars.innerHeight = chartVars.height - chartVars.topBottomPadding * 2;
       chartVars.translate = "translate(" + chartVars.leftPadding + "," + chartVars.topBottomPadding + ")";


  let barScales = {};  // placeholder for scale index object


  for (let att in domains) {  // get domain values for attributes
    console.log(domains[att])
    let yScale = d3.scaleLinear()  // create scale
      .range([chartVars.height, 0])  // goes to top
      .domain(domains[att]);  // input domain
    barScales[att] = yScale;  // save to scale index
  }

  let attInit = 'Total Incidents';  // starting attribute

  let chart = d3.select('#chart-box')  // placeholder container
    .append('svg')
    .attr('width', chartVars.innerWidth)
    .attr('height', chartVars.innerHeight)
    .attr('class', 'chart')
    .style('background-color', 'grey');  // moody

  let bars = chart.selectAll('.bar')  // create bars
    .data(attributes)  // load data
    .enter()  // ILLUSIONS, MICHAEL
    .append('rect')  // make a bar
    .sort(function (a, b) {  // sort bars by value
      return a[attInit] - b[attInit]
    })
    .attr('id', function (d) {
      return d.Area;
    })
    .classed('bar', true)
    .attr('width', chartVars.innerWidth / attributes.length - 1)  // separates bars w/padding
    .attr('height', function (d) {
      return chartVars.height - barScales[attInit](parseFloat(d[attInit]));  // get bar's scale
    })
    .attr('x', function (d, i) {
      return i * (chartVars.innerWidth / attributes.length)  // place the bar
    })
    .attr('y', function (d) {
      return 5 + (barScales[attInit](parseFloat(d[attInit])))  // calculate the height- value '5' provides padding
    });

  let yAxis = d3.axisRight()
        .scale(barScales[attInit]);


    //place axis
  let axis = chart.append("g")
      .attr("class", "axis")
      .attr("transform", chartVars.translate)
      .call(yAxis);


  // here we're going to loop through the boroughs to get their colors and assign those to the correct bar!
  barChanger(map);

};


var barChanger = function(map){
   // here we're going to loop through the boroughs to get their colors and assign those to the correct bar!
  let boroughs = map.selectAll(".borough");
  let boroughsArray = boroughs._groups[0];  // that's where you find those I guess

  for (let i=0; i < boroughsArray.length; i++){
    let id = boroughsArray[i].id;  // get the id of the borough
    let color = boroughsArray[i].style.cssText;  // get its color style value
    $("#" + id + '.bar').attr('style', color)  // use this fancy jquery selector to style the bar
  }
}
