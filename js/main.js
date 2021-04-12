
// define promises as d3 method objects
const promises = [d3.json('data/london_boroughs.json'), d3.csv('data/fly-tipping-borough.csv')];

// pass method objects to Promise constructor
const dataPromises = Promise.all(promises);

// the variables are global- I'm ok with this
var expressed = 'Total Incidents';

// allows boroughs to be highlighted without clipping border
d3.selection.prototype.moveToFront = function() {
  return this.each(function(){
    this.parentNode.appendChild(this);
  });
};

// in place of a proper margins object
var chartVars = {
    width: window.innerWidth * .33,
    height: 250,
    leftPadding: 1,
    rightPadding: 40,
    topBottomPadding: 10
  };

// calcualted values
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

  let width = window.innerWidth * .6,
    height = 775;

  const projection = d3.geoBonne() // because
    .center([-.09, 51.51]) // london, uk
    .scale(98000) // big number
    .translate([width / 2, (height / 2) - height * .05]); // centers the map w/ 5% vertical offset

  // may not be necessary, but it works, so here it is
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
    .style('background-color', 'rgba(255, 255, 255, .75)');

  map.call(zoom);

  // get data ready
  let boroughsGeoJSON = topojson.feature(datasets.boroughs, datasets.boroughs.objects.London_Borough_Excluding_MHW).features;
  let attributes = datasets.flyTipping;

  // add a title
  let mapTitle = map.append("text")
      .attr("x", 300)
      .attr("y", 30)
      .classed("mapTitle", true)
      .text("Fly Tipping in London Boroughs, 2018/19");

  dataJoin(boroughsGeoJSON, attributes); // get those attributes where they belong

  addBoroughs(map, path, boroughsGeoJSON, attributes); // attach centres to svg

  let scales = scaler(attributes);  // build scale object

  let boroughs = d3.selectAll('.borough')
    .style('fill', function(d){
      return choropleth(d.properties, scales)
        })
    .style('stroke', 'grey')
    .style('stroke-width', '.5px');

  addRadioButtons(map, attArray, attributes);  // makes buttons change expression

  chartFactory(map, attributes);  // makes a chart
};

var dataJoin = function(geodata, attributes){
  // joins data to geodata

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

  // the thing you point at
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
      .on('mouseenter', function() {  // highlights
      highlighter(this.id)
    })
    .style('fill-opacity', '.75')  // default value
    .on('mouseleave', function() {  // dehighlights
      dehighlighter(this.id)
    })
  .on("mousemove", function(event, d){  // tooltip mover
            d3.select(this).raise();
            return d3.select('.toolTip')
              .style("left", d3.pointer(event)[0]-1200 + "px")
              .style("top", d3.pointer(event)[1]-100 + "px")
              .style("display", "inline-block")
              .html("<b><p>" + (d.properties.NAME.replace('-', ' ')) + "</p></b> " + expressed + ": " + (d.properties[expressed]) + '%');
        })
    		.on("mouseout", function(d){tooltip.style("display", "none");});  // bye bye tooltip

};

let chartFactory = function (map, attributes) {
  // we're going to build a chart

  let scales = scaler(attributes);  // need those scales

  // another tooltip
  let tooltip = d3.select("#chart-box")
                  .append("div")
                  .classed("toolTip", true)
                  .attr('id', 'chart-tip')
                  .style('display', 'none');

  let chart = d3.select('#chart-box')  // placeholder container
    .append('svg')
    .attr('width', chartVars.width)
    .attr('height', chartVars.height)
    .attr('class', 'chart')
    .style('background-color', 'white');

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
      return chartVars.height - scales.y(parseFloat(d[expressed]))
    })
    .attr('x', function (d, i) {
      return i * (chartVars.innerWidth / attributes.length) + chartVars.leftPadding  // place the bar
    })
    .attr('y', function (d, i) {
      return scales.y(parseFloat(d[expressed]))
    })
    .style('fill', function (d, i){
      return choropleth(d, scales)  // gives it the proper color
    })
    .on('mouseenter', function() {  // highlights
      highlighter(this.id)
    })
    .on("mousemove", function(event, d){  // tooltip mover

            let id = d.Area;
            d3.select('path#' + id + '.borough').raise();

            return d3.select('.toolTip')
              .style("left", d3.pointer(event)[0]-chartVars.rightPadding + "px")
              .style("top", d3.pointer(event)[1]+300 + "px")
              .style("display", "inline-block")
              .html("<b>" + (d.Area.replace('-', ' ')) + "</b><br> " + expressed + ": " + (d[expressed]) + '%');
        })
  .on('mouseleave', function() {  // dehighlights
      dehighlighter(this.id);
      d3.select('.toolTip').style('display', 'none')  // hides tooltip
    });

  let locale = {"currency": ["", "%"]};  // formats scale values with % sign

  let x = d3.formatLocale(locale);

  // add y axis
  let yAxis = d3.axisRight()
        .scale(scales.y)
        .tickFormat(x.format('$'));

  //place axis
  let axis = chart.append("g")
      .classed('axis', true)
      .attr("transform", 'translate(' + (chartVars.innerWidth + 10) + ', ' + chartVars.topBottomPadding * 2 +')')
      .call(yAxis);

  // title for chart
  let chartTitle = chart.append("text")
        .attr("x", 20)
        .attr("y", 20)
        .classed("chartTitle", true)
        .text("London Boroughs ranked by % of " + expressed + ", 2018/19");


};

var addRadioButtons = function(map, attArray, attributes) {
  // a click switches the radio button, then runs colorizer function on all boroughs for that attribute
  console.log(attArray);
  d3.selectAll('input')
    .on('click', function(){
      expressed = this.value;  // sets current expressed
      changeExpression(attributes); // changes visual elements according to expressed attribute
      changeInfoBox();  // cycles html for associated content
    });
};

var scaler = function(attributes){
    // makes the scales we need
    // yay colorbrewer
    const colors = {
      'Total Incidents': colorbrewer.OrRd['5'],
      'Total Actions Taken': colorbrewer.BuGn['5'],
      'Warning Letters': colorbrewer.PuBuGn['5'],
      'Fixed Penalty Notices': colorbrewer.RdPu['5'],
      'Statutory Notices': colorbrewer.Blues['5'],
      'Formal Cautions': colorbrewer.Oranges['5'],
      'Prosecutions': colorbrewer.PuRd['5'],
      'Change from Five Years Ago': colorbrewer.YlOrBr['5']
      };

    let values = knowValues(attributes).map(Number.parseFloat);  // gets values for domain

    let domain = [d3.min(values), d3.max(values)];  // here's the domain for this attribute
    console.log(domain);

    // jenks classification
    let clusters = ss.ckmeans(values, 5);  // determine attribute value clusters
    let breaks = clusters.map(function(d){
        return d3.min(d);
    });
    console.log(breaks);

    // color scale
     let colorScale = d3.scaleQuantile()
                          .range(colors[expressed])
                          .domain(breaks);
    // y scale
     let yScale = d3.scaleLinear()
                      .range([chartVars.innerHeight, chartVars.topBottomPadding])
                      .domain(domain);
    // scales object
     let scales = {
       'color': colorScale,
       'y': yScale,
     };

  return scales;


};

let choropleth = function(props, scales){
  let val = props[expressed];
  return scales.color(val)  // check val, make color
};

var changeExpression = function(attributes){
  let scales = scaler(attributes);  // get scales

  // change boroughs
  let boroughs = d3.selectAll('.borough')
    .transition('color_boroughs')  // prevents collisions
    .duration(1500)
    .delay(100)
    .ease(d3.easePolyInOut)  // looks cool
    .style('fill', function(d){
      return choropleth(d.properties, scales)  // changes color
    });

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

  // axis format
  let locale = {"currency": ["", "%"]};
    let x = d3.formatLocale(locale);

    // make axis
    let yAxis = d3.axisRight()
        .scale(scales.y)
        .tickFormat(x.format('$'));

    // transition it in
    let axis = d3.selectAll('.axis')
      .transition('shift_axis')
      .duration(1500)
      .ease(d3.easePolyInOut)
      .call(yAxis)

  // change title
    let chartTitle = d3.select('.chartTitle')
      .text("London Boroughs ranked by % of " + expressed + ", 2018/19");

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
        .style('fill-opacity', '1');

    let borough = d3.select('#' + id + '.borough')
      .transition('highlight_boroughs')
      .ease(d3.easePolyInOut)
      .duration(150)
        .style("stroke", "black")
        .style("stroke-width", "2")
        .style('fill-opacity', '1')

};

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

var changeInfoBox = function(){

  // checks expressed value and changes the text accordingly
  switch(expressed) {
    case 'Total Incidents':
      d3.select('.info-header')
        .html('Fly Tipping In London');

      d3.select('.info-body')
        .html('Fly tipping, also called illegal dumping, occurs when rubbish, trash, or other refuse is\n' +
          'disposed of improperly in a public environment.  Fly tipping is typically driven by household waste ' +
          'and bulk items, left in surreptitious locations by householders or unlicensed waste collectors.');

      break;

      case 'Change from Five Years Ago':
      d3.select('.info-header')
        .html('Change from Five Years Ago');

      d3.select('.info-body')
        .html('Fly tipping is an increasingly pervasive issue in London.  Last year, over 300,000 incidents of fly tipping' +
          ' were recorded across the city, creating environmental hazards within local communities and racking up costs related to' +
          " mitigation.  Fly tipping disposals cost the city's 33 Councils £18.4m in 2016/17.");
      break;

    case 'Total Actions Taken':
      d3.select('.info-header')
        .html('Total Actions Taken');

      d3.select('.info-body')
        .html('In 2018/19, over 157,000 enforcement actions were taken as a result of fly tipping incidents.  \n' +
          'These sanctions range from written warnings to formal prosecution.  Fly tipping sanctions are' +
          ' typically the result of an investigation related to an incident, such as a review of CCTV footage.');
      break;

    case 'Warning Letters':
      d3.select('.info-header')
        .html('Warning Letters');

      d3.select('.info-body')
        .html('Warning letters are the mildest form of sanction.  These letters typically inform the recipient that they\'ve been ' +
          "connected to a fly tipping investigation, and how to properly dispose of household waste. In 2019/20, more than 8,500 Warning " +
          "Letters were issued as a result of fly tipping investigations in London.");
      break;

    case 'Fixed Penalty Notices':
       d3.select('.info-header')
        .html('Fixed Penalty Notices');

      d3.select('.info-body')
        .html('Since 2016, Councils have been empowered to issue Fixed Penalty Notices in response to fly tipping incidents,' +
          ' which have become the primary enforcement response in many boroughs.  Issuing and enforcing Fixed Penalty Notices ' +
          ' costs the city more than the incoming revenue from the associated fines.');
      break;

    case 'Statutory Notices':
       d3.select('.info-header')
        .html('Fixed Penalty Notices');

      d3.select('.info-body')
        .html('As fly tipping has become increasingly problematic, London has innovated new enforcement methods to combat' +
          ' these issues and reduce incidents of fly tipping.  In 2019, Councils were given the authority to fine households'+
          ' up to $400 if their waste is illegally fly tipped by an informal waste collector.');
      break;

    case 'Formal Cautions':
       d3.select('.info-header')
        .html('Formal Cautions');

      d3.select('.info-body')
        .html('This shift in strategies for targeted enforcement action against fly tipping is evident in the data- ' +
          'Formal Cautions have largely fallen out of favor due to the availability of Fixed Penalty Notices, which' +
          ' imply the admission of guilt alongside the promise of no further action ones the fine is paid.');
      break;

    case 'Prosecutions':
       d3.select('.info-header')
        .html('Prosecutions');

      d3.select('.info-body')
        .html('Prosecutions have also declined dramatically in London, although they remain a focus of enforcement elsewhere' +
          ' in the country.  Prosecutions are costly to pursue, and as such, pursuing a strategy of prosecution for small-scale' +
          ' fly tipping incidents is often inefficient in densely populated areas.');
      break;
  }

};
