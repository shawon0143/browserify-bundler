## Browserify Bundler

A simple bundler for any js or ts module.

### Build Locally

- Clone the repo
- npm install
- Add your module as `main.js` file or `main.ts` file.
- Command for typescript build : `npm run build-ts`
- Command for javascript build : `npm run build-js`

In both command a new file `bundle.js` will be generated.

### Minify
To minify the bundle run `npm run minify`. A new file `minifiedBundle.js` will be generated.


### How to use in HTML

To use in an HTML file just import as a script

```
<script
   type="text/javascript"
   src="path/to/your/minifiedBundle.js"
></script>
```

Then call function like below

```
<script type="text/javascript">
   module.functionName();
</script>
```

### How to use in React Component

To use in a React component download and save the script in your project.(i.e utils/bundle.js) and import in the component `import module from './bundle';`. An example  of initialise inside the componentDidMount lifecycle.

```
componentDidMount() {
    module.functionName();
}
```
