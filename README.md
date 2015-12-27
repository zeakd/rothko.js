# Rothko.js
get dominant, chroma, achroma, and point colors in photo, with some data of colors.

# Install 

## requirejs

## commonjs

## script tag
You should install latest version of dependencies, [chroma](https://github.com/gka/chroma.js), [drawing-kit](https://github.com/zeakd/drawing-kit.js), [histogram-analyze](https://github.com/zeakd/histogram-analyze.js). 

```html
    <body>
        ...
        <script src="path/to/chroma.js"></script>
        <script src="path/to/drawing-kit.js"></script>
        <script src="path/to/histogram-analyze.js"></script>
        <script src="path/to/rothko.js"></script>
        <script src="your/script/file"></script>
    </body>
```

# Usage


## browser

```js
var img = new Image();
img.src = "path/to/image"
var roth = Rothko(img);

img.onload = function () {
    var colors = roth.getColorsSync();
    console.log(colors.dominants,
                colors.points,
                colors.chromas,
                colors.achromas);
}

```