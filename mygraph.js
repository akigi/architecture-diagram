function makeSVG(addGridLines, mywidth, myheight) {
    var svg = d3.select("body").append("svg")
        .attr("width", mywidth)
        .attr("height", myheight);
    return svg;
}


function gridify(svg, pgLayout, margin, groupMargin) {
    // routes
    var routes = cola.gridify(pgLayout, 5, margin, groupMargin);
    console.log("routes", routes)
    svg.selectAll('path').remove();

    // forEach
    routes.forEach(route => {
        var cornerradius = 5;
        var arrowwidth = 3;
        var arrowheight = 7;
        var p = cola.GridRouter.getRoutePath(route, cornerradius, arrowwidth, arrowheight);
        if (arrowheight > 0) {
            svg.append('path')
                .attr('class', 'linkarrowoutline')
                .attr('d', p.arrowpath);
            svg.append('path')
                .attr('class', 'linkarrow')
                .attr('d', p.arrowpath);
        }
        svg.append('path')
            .attr('class', 'linkoutline')
            .attr('d', p.routepath)
            .attr('fill', 'none');
        svg.append('path')
            .attr('class', 'link')
            .attr('d', p.routepath)
            .attr('fill', 'none');
    });

    // label
    svg.selectAll(".label").transition().attr("x", d => d.routerNode.bounds.cx())
        .attr("y", function (d) {
            var h = this.getBBox().height;
            return d.bounds.cy() + h / 3.5;
        });

    // node
    svg.selectAll(".node").transition().attr("x", d => d.routerNode.bounds.x)
        .attr("y", d => d.routerNode.bounds.y)
        .attr("width", d => d.routerNode.bounds.width())
        .attr("height", d => d.routerNode.bounds.height());


    // group
    let groupPadding = margin - groupMargin;
    svg.selectAll(".group").transition().attr('x', d => d.routerNode.bounds.x - groupPadding)
        .attr('y', d => d.routerNode.bounds.y + 2 * groupPadding)
        .attr('width', d => d.routerNode.bounds.width() - groupPadding)
        .attr('height', d => d.routerNode.bounds.height() - groupPadding);
}

function createPowerGraph(inputjson) {
    // size
    var size = [700, 700];
    var grouppadding = 0.01;
    var margin = 20;
    var groupMargin = 15;

    // svg
    var svg = makeSVG(false, size[0], size[1]);

    // inputJson.nodes
    inputjson.nodes.forEach(v => {
        v.width = 70;
        v.height = 70;
    });

    // pgLayout
    var pgLayout = cola.powerGraphGridLayout(inputjson, size, grouppadding);
    // pgLayout.cola._nodes[0].x = 0

    // debug
    console.log("inputjson", inputjson)
    console.log("pgLayout", pgLayout)

    // filter duplicate links:
    //var es = pgLayout.powerGraph.powerEdges;
    //var copy = [];
    //var n = pgLayout.cola.nodes().length;
    //for (var i = 0; i < es.length; i++) {
    //    var e = es[i];
    //    var dupFound = false;
    //    for (var j = i + 1; j < es.length; j++) {
    //        var f = es[j];
    //        dupFound = ((getId(e.source, n) == getId(f.source, n)) && (getId(e.target, n) == getId(f.target, n)))
    //        || ((getId(e.target, n) == getId(f.source, n)) && (getId(e.source, n) == getId(f.target, n)));
    //        if (dupFound) break;
    //    }
    //    if (!dupFound) copy.push(e);
    //}
    //pgLayout.powerGraph.powerEdges = copy;

    // group
    var group = svg.selectAll(".group")
        .data(pgLayout.powerGraph.groups)
        .enter().append("rect")
        .attr("class", "group");

    // node
    var node = svg.selectAll(".node")
        .data(inputjson.nodes)
        .enter().append("rect")
        .attr("class", "node");
    node.append("title").text(d => d.name);

    // label
    var label = svg.selectAll(".label")
        .data(inputjson.nodes)
        .enter().append("text")
        .attr("class", "label")
        .text(d => d.name.replace(/^u/, ''));

    // gridify
    gridify(svg, pgLayout, margin, groupMargin);

    // Events
    let eventStart = {},
        ghosts = null;
    function getEventPos() {
        let ev = d3.event;
        let e = typeof TouchEvent !== 'undefined' && ev.sourceEvent instanceof TouchEvent ? (ev.sourceEvent).changedTouches[0] : ev.sourceEvent;
        return {
            x: e.clientX,
            y: e.clientY
        };
    }
    function dragStart(d) {
        ghosts = [1, 2].map(i => svg.append('rect')
            .attr({
                class: 'ghost',
                x: d.routerNode.bounds.x,
                y: d.routerNode.bounds.y,
                width: d.routerNode.bounds.width(),
                height: d.routerNode.bounds.height()
            }));
        eventStart[d.routerNode.id] = getEventPos();
    }
    function getDragPos(d) {
        let p = getEventPos(),
            startPos = eventStart[d.routerNode.id];
        return {
            x: d.routerNode.bounds.x + p.x - startPos.x,
            y: d.routerNode.bounds.y + p.y - startPos.y
        };
    }
    function drag(d) {
        var p = getDragPos(d);
        ghosts[1].attr(p);
    }
    function dragEnd(d) {
        let dropPos = getDragPos(d);
        delete eventStart[d.routerNode.id];
        console.log("d", d)
        d.x = dropPos.x;
        d.y = dropPos.y;
        ghosts.forEach(g => g.remove());
        if (Object.keys(eventStart).length === 0) {
            gridify(svg, pgLayout, margin, groupMargin);
        }
    }

    // Events Listener
    let dragListener = d3.behavior.drag()
        .on("dragstart", dragStart)
        .on("drag", drag)
        .on("dragend", dragEnd);

    // call
    node.call(dragListener);
    label.call(dragListener);
}

// Do
a = d3.text("graphdata.dot", function (f) {
    // f
    // console.log("f", f)

    // digraph
    var digraph = graphlibDot.read(f);

    console.log("digraph", digraph)

    // nodes
    var nodeNames = digraph.nodes();
    console.log("digraph.nodes()", digraph.nodes())
    var nodes = new Array(nodeNames.length);
    nodeNames.forEach(function (name, i) {
        var v = nodes[i] = digraph._nodes[nodeNames[i]];
        v.id = i;
        v.name = name;
    });
    console.log("nodes[0]", nodes[0])

    // edges
    const dedges = (digraph.edges());
    console.log("digraph.edges()", digraph.edges())
    let edges = [];
    for (let edge of dedges) {
        edges.push({
            source: digraph._nodes[edge.v].id,
            target: digraph._nodes[edge.w].id
        });
    }
    console.log("edges[0]", edges[0])
    console.log("edges[0].source", edges[0].source)

    // createPowerGraph
    let arg = {
        nodes: nodes,
        links: edges
    };
    console.log("arg", arg);
    createPowerGraph(arg);
});



// https://127.0.0.1:4001


// var graph = {
//     nodes: [   
//         {id: 0, name: "node0", width: 70, height: 70},
//         {id: 1, name: "node1", width: 70, height: 70},
//         {id: 2, name: "node2", width: 70, height: 70},
//         {id: 3, name: "node3", width: 70, height: 70},
//     ],
//     links: [
//         {source: 0, target: 1},
//         {source: 0, target: 2},
//         {source: 3, target: 0},
//     ]
// }

var G = `digraph G {
node1[label="node 1"];
node2[label="node 2"];
node3[label="node 3"];
node4[label="node 4"];
node1 -> node2[label="()"];
node2 -> node4[label="()"];
node2 -> node3[label="()"];
node2 -> node1[label="()"];
node1 -> node2[label="()"];
}
`;

var digraph = graphlibDot.read(G);
console.log("digraph", digraph);

var graph = {
    nodes: [],
    links: []
}

digraph.nodes().forEach((nodeName, i) => {
    let node = digraph._nodes[nodeName];
    node.id = i;
    node.name = nodeName;
    node.width = 70;
    node.height = 70;
    graph.nodes.push(node);
});


for (let edge of digraph.edges()) {
    graph.links.push({
        source: digraph._nodes[edge.v].id,
        target: digraph._nodes[edge.w].id
    });
}
console.log("graph", graph);

var size = [700, 700];
var grouppadding = 0.01;
var margin = 20;
var groupMargin = 15;


var pgLayout = cola.powerGraphGridLayout(graph, size, grouppadding);
console.log("pgLayout", pgLayout)
// pgLayout.powerGraph.groups = [];

pgLayout.powerGraph.powerEdges = [];

pgLayout.powerGraph.powerEdges.push(
    {
        source: graph.nodes[3],
        target: graph.nodes[1],
        type: 0
    },
    {
        source: graph.nodes[0],
        target: graph.nodes[1],
        type: 0
    }
    
)

var routes = cola.gridify(pgLayout, 5, margin, groupMargin);
console.log("routes", routes);

// svg
var svg = d3.select("body").append("svg")
    .attr("width", size[0])
    .attr("height", size[1]);

var node = svg.selectAll(".node")
    .data(graph.nodes)
    .enter().append("rect")
    .attr("x", d => d.routerNode.bounds.x)
    .attr("y", d => d.routerNode.bounds.y)
    .attr("width", d => d.routerNode.bounds.width())
    .attr("height", d => d.routerNode.bounds.height())
    .attr("class", "node")
    .attr("fill", "black")

routes.forEach(route => {
    var cornerradius = 5;
    var arrowwidth = 3;
    var arrowheight = 7;
    var p = cola.GridRouter.getRoutePath(route, cornerradius, arrowwidth, arrowheight);
    // console.log("p", p)
    svg.append("path")
        .attr("class", "link")
        .attr("d", p.routepath)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 2);
    svg.append("path")
        .attr("class", "linkarrow")
        .attr("d", p.arrowpath)
        .attr("stroke", "black")
        .attr("stroke-width", 2);    
});




// group
var group = svg.selectAll(".group")
    .data(pgLayout.powerGraph.groups)
    .enter().append("rect")
    .attr("class", "group");

// node
var node = svg.selectAll(".node")
    .data(graph.nodes)
    .enter().append("rect")
    .attr("class", "node");
node.append("title").text(d => d.name);

// label
var label = svg.selectAll(".label")
    .data(graph.nodes)
    .enter().append("text")
    .attr("class", "label")
    .text(d => d.name.replace(/^u/, ''));

