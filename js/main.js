
// define promises as d3 method objects
const promises = [d3.json('data/london_boroughs.json'), d3.csv('data/fly-tipping-borough.csv')];

// pass method objects to Promise constructor
const dataPromises = Promise.all(promises);

var expressed = 'Total Incidents';

d3.selection.prototype.moveToFront = function() {
  return this.each(function(){
    this.parentNode.appendChild(this);
  });
};


var chartVars = {
    width: window.innerWidth * .3,
    height: 500,
    leftPadding: 1,
    rightPadding: 40,
    topBottomPadding: 10
  };

chartVars.innerWidth = chartVars.width - chartVars.leftPadding - chartVars.rightPadding;
chartVars.innerHeight = chartVars.height - (chartVars.topBottomPadding * 2);
chartVars.translate = "translate(" + chartVars.leftPadding + "," + chartVars.topBottomPadding + ")";

// call promises, construct datasets object, pass to map generation function
dataPromises.then(function(data) {
  console.log(data);
  const datasets = {
    boroughs: data[0],
    flyTipping: data[1]
  };

  const attArray = Object.keys(datasets.flyTipping[0]); // list of attributes
  attArray.shift();
  attArray.shift();

  generateMap(datasets, attArray);

});

// in case of error
dataPromises.catch(function(){
  console.log("Promises not kept.")
});

var generateMap = function(datasets, attArray) {

  let width = window.innerWidth * .5,
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
    .style('background-color', 'white');

  map.call(zoom);
  let boroughsGeoJSON = topojson.feature(datasets.boroughs, datasets.boroughs.objects.London_Borough_Excluding_MHW).features;
  let attributes = datasets.flyTipping;

  dataJoin(boroughsGeoJSON, attributes); // get those attributes where they belong

  addBoroughs(map, path, boroughsGeoJSON, attributes); // attach centres to svg

  let scales = scaler(attributes);

  let boroughs = d3.selectAll('.borough')
    .style('fill', function(d){
      return choropleth(d.properties, scales)
        })
    .style('stroke', 'grey')
    .style('stroke-width', '.5px');

  addRadioButtons(map, attArray, attributes);

  chartFactory(map, attributes);



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

var addBoroughs = function(map, path, boroughsGeoJSON, attributes) {

  // this is where the centre paths are created and added.  when they are added, they are also given a colorspace.
  // in converting attribute value to color value via color scale, each areal unit has a possible colorspace of (in
  // this case) 9 values.  In order to provide convenient and efficient color switching, we'll simply use the color
  // scales object created in colorize() to define an object which contains the color value of each attribute
  // for each town centre.  This will be called by .style() when the attribute selector radio button changes state.

    let tooltip = d3.select("#chart-box")
                  .append("div")
                  .classed("toolTip", true);

  map.selectAll('path')  // create path object placeholders
    .data(boroughsGeoJSON)  // feed d3
    .enter()  // enter topology array
    .append('path')  // append path to svg
    .attr('d', path) // assign path data to svg path
    .attr('id', function (d) {
      return d.properties.NAME  // tag sitename to path
    })
    .classed('borough', true)  // add class
      .on('mouseenter', function() {
      highlighter(this.id)
    })
    .style('fill-opacity', '.75')
    .on('mouseleave', function() {
      dehighlighter(this.id)
    })
  .on("mousemove", function(event, d){
            d3.select(this).raise()
            return d3.select('.toolTip')
              .style("left", d3.pointer(event)[0]-900 + "px")
              .style("top", d3.pointer(event)[1]-100 + "px")
              .style("display", "inline-block")
              .html("<b><p>" + (d.properties.NAME.replace('-', ' ')) + "</p></b> " + expressed + ": " + (d.properties[expressed]) + '%');
        })
    		.on("mouseout", function(d){ tooltip.style("display", "none");});

};

let chartFactory = function (map, attributes) {
  // we're going to build a chart

  let scales = scaler(attributes);

  let tooltip = d3.select("#chart-box")
                  .append("div")
                  .classed("toolTip", true)
                  .classed('card', true)

  let chart = d3.select('#chart-box')  // placeholder container
    .append('svg')
    .attr('width', chartVars.width)
    .attr('height', chartVars.height)
    .attr('class', 'chart')
    .style('background-color', 'white');  // moody

  let bars = chart.selectAll('.bar')  // create bars
    .data(attributes)  // load data
    .enter()  // ILLUSIONS, MICHAEL
    .append('rect')  // make a bar
    .sort(function (a, b) {  // sort bars by value
      return a[expressed] - b[expressed]
    })
    .attr('id', function (d) {
      return d.Area;
    })
    .classed('bar', true)
    .attr('width', chartVars.innerWidth / attributes.length - 3)  // separates bars w/padding
    .attr('height', function (d, i) {
      return scales.y(0) - scales.y(parseFloat(d[expressed]))
    })
    .attr('x', function (d, i) {
      return i * (chartVars.innerWidth / attributes.length) + chartVars.leftPadding  // place the bar
    })
    .attr('y', function (d, i) {
      return scales.y(parseFloat(d[expressed]))
    })
    .style('fill', function (d, i){
      return choropleth(d, scales)
    })
    .on('mouseenter', function() {
      highlighter(this.id)
    })
    .on("mousemove", function(event, d){

            let id = d.Area;
            d3.select('path#' + id + '.borough').raise();
            console.log(id);
            return d3.select('.toolTip')
              .style("left", d3.pointer(event)[0]-chartVars.rightPadding + "px")
              .style("top", d3.pointer(event)[1]+150 + "px")
              .style("display", "inline-block")
              .html("<b>" + (d.Area.replace('-', ' ')) + "</b><br> " + expressed + ": " + (d[expressed]) + '%');
        })
  .on('mouseleave', function() {
      dehighlighter(this.id)
      tooltip.style("opacity", "0")
    })


  let locale = {"currency": ["", "%"]};

  let x = d3.formatLocale(locale);


  let yAxis = d3.axisRight()

        .scale(scales.y)
        .tickFormat(x.format('$'));


    //place axis
  let axis = chart.append("g")
      .classed('axis', true)
      .attr("transform", 'translate(' + (chartVars.innerWidth + 10) + ', ' + chartVars.topBottomPadding * 2 +')')
      .call(yAxis);


};

var addRadioButtons = function(map, attArray, attributes) {
  // a click switches the radio button, then runs colorizer function on all boroughs for that attribute
  console.log(attArray);
  d3.selectAll('input')
    .on('click', function(){
      expressed = this.value;
      changeExpression(attributes);
      changeInfoBox();
    });
};

var scaler = function(attributes){

    const colors = {
      'Total Incidents': colorbrewer.BuGn['5'],
      'Total Actions Taken': colorbrewer.OrRd['5'],
      'Warning Letters': colorbrewer.PuBuGn['5'],
      'Fixed Penalty Notices': colorbrewer.RdPu['5'],
      'Statutory Notices': colorbrewer.Blues['5'],
      'Formal Cautions': colorbrewer.Oranges['5'],
      'Prosecutions': colorbrewer.PuRd['5'],
      'Change from Previous Year': colorbrewer.YlOrBr['5'],
      'Change from Five Years Ago': colorbrewer.GnBu['5']
      };

    let values = knowValues(attributes).map(Number.parseFloat)




    let domain = [d3.min(values), d3.max(values)];  // here's the domain for this attribute
    console.log(domain);

    let clusters = ss.ckmeans(values, 5);  // determine attribute value clusters
    let breaks = clusters.map(function(d){
        return d3.min(d);
    });
    console.log(breaks);


     let colorScale = d3.scaleQuantile()
                          .range(colors[expressed])
                          .domain(breaks);

     let yScale = d3.scaleLinear()
                      .range([chartVars.innerHeight, chartVars.topBottomPadding])
                      .domain(domain);

     let scales = {
       'color': colorScale,
       'y': yScale,
     };

  return scales;


};

let choropleth = function(props, scales){
  let val = props[expressed];
  return scales.color(val)
};

var changeExpression = function(attributes){
  let scales = scaler(attributes);

  let boroughs = d3.selectAll('.borough')
    .transition('color_boroughs')
    .duration(1500)
    .delay(100)
    .ease(d3.easePolyInOut)
    .style('fill', function(d){
      return choropleth(d.properties, scales)
    });

  let values = knowValues(attributes);

  let overZero = values.filter(a => a > 0);

  let width = chartVars.innerWidth / overZero.length - 1;

  let bars = d3.selectAll(".bar")
        .sort(function(a, b){
            return a[expressed] - b[expressed];
        })
        .transition('move_bars')
        .ease(d3.easePolyInOut)
        .duration(1500)
        .attr("x", function(d, i){
            return i * (chartVars.innerWidth / attributes.length) + chartVars.leftPadding;
        })
        //resize bars
        .attr("height", function(d, i){
          return chartVars.height - scales.y(parseFloat(d[expressed]))
        })
        .attr("y", function(d, i){
            return scales.y(parseFloat(d[expressed]))

        })
        //recolor bars
        .style("fill", function(d){
            return choropleth(d, scales);
        });

    let locale = {"currency": ["", "%"]};
    let x = d3.formatLocale(locale);

    let yAxis = d3.axisRight()
        .scale(scales.y)
        .tickFormat(x.format('$'));

    let axis = d3.selectAll('.axis')
      .transition('shift_axis')
      .duration(1500)
      .ease(d3.easePolyInOut)
      .call(yAxis)

};

var knowValues = function(attributes) {
  let values = [];
    for (let row = 0; row < attributes.length; row++) {  // loop through town centres
      let val = attributes[row][expressed];
      values.push(val);  // it goes in the array
    }

    return values
};

var highlighter = function (id){
    //change stroke

    let bar = d3.select('#' + id + '.bar')
      .transition('highlight_bars')
      .ease(d3.easePolyInOut)
      .duration(100)
        .style("stroke", "black")
        .style("stroke-width", "2")
        .style('fill-opacity', '1')

    let borough = d3.select('#' + id + '.borough')
      .transition('highlight_boroughs')
      .ease(d3.easePolyInOut)
      .duration(150)
        .style("stroke", "black")
        .style("stroke-width", "2")
        .style('fill-opacity', '1')

}

var dehighlighter = function (id){
    //change stroke

    let bar = d3.selectAll('#' + id + '.bar')
      .transition('dehighlight_bars')
      .ease(d3.easePolyInOut)
      .delay(200)
      .duration(100)
        .style("stroke", "grey")
        .style("stroke-width", "1")
        .style('fill-opacity', '.5');

    let borough = d3.select('#' + id + '.borough')
      .transition('dehighlight_boroughs')
      .ease(d3.easePolyInOut)
      .delay(50)
      .duration(250)
        .style("stroke", "grey")
        .style("stroke-width", ".75")
        .style('fill-opacity', '.75')
};

let changeInfoBox = function(){
  switch(expressed) {
    case 'Total Incidents':
      d3.selectAll('.info-card')
        .classed('active', false)
        .classed('hidden', true)
        .style('display', 'none');

      d3.select('#info-card-total')
        .classed('active', true)
      .style('display', 'd-block')

      break;

    case 'Total Actions Taken':
      d3.selectAll('.info-card')
        .classed('hidden', true)
        .classed('active', false)
      .style('display', 'none')

      d3.select('#info-card-actions')
        .classed('active', true)
      .style('display', 'd-block')
  }
}
