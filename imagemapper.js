/**
 * 
 * @author Patrick Oladimeji
 * @date 10/21/13 21:42:17 PM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, d3, require, $, brackets, window, MouseEvent */
var mapper;
(function () {
    "use strict";
    /**
        get client rect for the given element
    */
    function cr(el) {
        return el.node().getBoundingClientRect();
    }
    
    function createRegion(svg, startPos, dispatcher) {
        svg.selectAll("g.selected").classed("selected", false);//clear previous selections
        var g = svg.append("g").attr("class", "selected"), moved = false, moveRegionStarted = false;
        var region = g.append("rect").attr("x", startPos.x).attr("y", startPos.y).attr("class", "region");
        var helperPos = ['tl', 'tr', 'br', 'bl'], hw = 5, cornerOffset = hw / 2,
            helperData = helperPos.map(function (d) {return {x: cornerOffset, y: cornerOffset, align: d}; });
        var corners = g.selectAll("rect.corner").data(helperData).enter()
            .append("rect").attr("class", function (d) { return d.align + " corner"; })
            .attr("width", hw).attr("height", hw);
        
        function sortPoints(a, b) { return a.y === b.y ? a.x - b.x : a.y - b.y; }

        function updateRegion(r, d) {
            d.width = isNaN(d.width) || d.width === null ? parseFloat(r.attr("width")) : d.width;
            d.height = isNaN(d.height) || d.height === null ? parseFloat(r.attr("height")) : d.height;
            
            r.attr("width", Math.abs(d.width)).attr("height", Math.abs(d.height)).attr("x", d.x).attr("y", d.y);
            //update corners
            var cdata = corners.data();
            cdata.forEach(function (cd, i) {
                cd.x = i === 0 || i === 3 ? d.x : d.x + Math.abs(d.width);
                cd.y = i === 0 || i === 1 ? d.y : d.y + Math.abs(d.height);
                cd.align = helperPos[i];
            });
            corners.data(cdata).attr("x", function (d) {return d.x - cornerOffset; })
                .attr("y", function (d) {return d.y - cornerOffset; });
        }
        
        svg.on("mousemove", function () {
            moved = true;
            var e = {x: d3.mouse(this)[0], y: d3.mouse(this)[1]};
            //calculate the delta movement and update rect with and height
            var w = e.x - startPos.x, h = e.y - startPos.y, x = w < 0 ? startPos.x + w : startPos.x,
                y = h < 0 ? startPos.y + h : startPos.y;
            updateRegion(region, {x: x, y: y, height: h, width: w});
            d3.event.stopPropagation();
            d3.event.preventDefault();
        }).on("mouseup", function () {
            if (!moved) {
                region.remove();
            } else {
                dispatcher.create({region: region, pos: cr(region)});//dispatch create event
            }
            svg.on("mousemove", null)
                .on("mouseup", null);
        });
        
        //create move listener for region
        region.on("mousedown", function () {
            var mdPos = {x: d3.mouse(this)[0], y: d3.mouse(this)[1]}, rxStart = +region.attr("x"), ryStart = +region.attr("y");
            d3.event.stopPropagation();
            d3.event.preventDefault();
            //register mousemove for the svg when moused down on the region
            svg.on("mousemove.region", function () {
                var e = {x: d3.mouse(this)[0], y: d3.mouse(this)[1]};
                var delta = {x: (e.x - mdPos.x), y: (e.y - mdPos.y)};
                updateRegion(region, {x: rxStart + delta.x, y: ryStart + delta.y});
            });
            
            region.on("mouseup", function () {
                svg.on("mousemove.region", null);
                dispatcher.move({region: region, pos: cr(region)});
            });
            //higlight the region show it has been selected
            if (!d3.event.ctrlKey) {//remove previous selections if ctrl key wasnt pressed
                svg.selectAll("g.selected").classed("selected", false);
            }
            g.classed("selected", true);
        });
        
        //create listener for corners
        corners.on("mousedown", function (d, i) {
            d3.event.preventDefault();
            d3.event.stopPropagation();
            var mdPos = {x: d3.mouse(this)[0], y: d3.mouse(this)[1]}, rx = +region.attr("x"),
                ry = +region.attr("y"), rw = parseFloat(region.attr("width")), rh = parseFloat(region.attr("height"));
            var w, h, x, y;
            svg.on("mousemove.corner", function () {
                d3.event.preventDefault();
                d3.event.stopPropagation();
                var mmPos = {x: d3.mouse(this)[0], y: d3.mouse(this)[1]};
                var dx = mmPos.x - mdPos.x, dy = mmPos.y - mdPos.y;
               // var w = rw + dx, h = rw + dy, x = w < 0 ? mmPos.x : rx, y = h < 0 ? mmPos.y : ry;
                if (d.align === "tl") {
                    x = mmPos.x < (rx + rw) ? mmPos.x : (rx + rw);
                    y = mmPos.y < (ry + rh) ? mmPos.y : (ry + rh);
                    w = rw - dx;
                    h = rh - dy;
                } else if (d.align === "tr") {
                    y = mmPos.y < (ry + rh) ? mmPos.y : (ry + rh);
                    x = mmPos.x > rx ? rx : mmPos.x;
                    w = rw + dx;
                    h = rh - dy;
                } else if (d.align === "br") {
                    w = rw + dx;
                    h = rh + dy;
                    x = mmPos.x > rx ? rx : mmPos.x;
                    y = mmPos.y > ry ? ry : mmPos.y;
                } else if (d.align === "bl") {
                    x = mmPos.x < (rx + rw) ? mmPos.x : (rx + rw);
                    y = mmPos.y > (ry) ? ry : (mmPos.y);
                    w = rw - dx;
                    h = rh + dy;
                }
                d3.select(this).attr("x", mmPos.x).attr("y", mmPos.y);
                updateRegion(region, {x: x, y: y, width: w, height: h});
            });
            
            d3.select(this).on("mouseup", function (d, i) {
                svg.on("mousemove.corner", null);
                //dispatch move event
                dispatcher.resize({region: region, old: {x: rx, y: ry, w: rw, h: rh}, current: {x: x, y: y, h: h, w: w}, pos: cr(region)});
            });
        });
        
        return region;
    }
    
    function booya(config) {
        if (!config || !config.element) { throw new Error("element prpoerty of config must be set"); }
        
        var imageEl = d3.select(config.element), props, mapLayer, ed = d3.dispatch("create", "remove", "resize", "move");
        imageEl.on("load", function () {
            props = cr(imageEl);
            mapLayer = d3.select("body").append("svg").attr("width", props.width).attr("height", props.height)
                .style("position", "absolute").style("top", props.top + "px").style("left", props.left + "px").style("cursor", "crosshair");
            //update map layer on document scroll
            d3.select("body").on("scroll", function () {
                props = cr(imageEl);
                mapLayer.style("top", props.top + "px").style("left", props.left + "px").attr("width", props.width).attr("height", props.height);
            }).on("keydown", function () {
                var e = d3.event;
                e.preventDefault();
                e.stopPropagation();
                if (e.which === 46 || e.which === 8) {
                    ed.remove({regions: mapLayer.selectAll("g.selected")});
                }
            });
            
            mapLayer.on("mousedown", function () {
                var e = d3.event;
                createRegion(mapLayer, {x: d3.mouse(this)[0], y: d3.mouse(this)[1]}, ed);
                e.preventDefault();
            });
        });
        
        
        function getImageMapData() {
            var regions = mapLayer.selectAll("rect.region");
            var map = [];
            regions.each(function () {
                var r = d3.select(this), coords = [r.attr("x"), r.attr("y"), r.attr("width"), r.attr("height")];
                var data = {shape: "rect", coords: coords.join(",")};
                map.push(data);
            });
            
            return map;
        }
        
        return {
            getImageMapData: getImageMapData,
            on: function (type, f) {
                ed.on(type, f);
                return this;
            }
        };
    }
    
    mapper = booya;
}());