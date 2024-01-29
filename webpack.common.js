const path = require("path");
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");


const fileExtensions = ["jpg", "jpeg", "png", "gif", "eot", "otf", "svg", "ttf", "woff", "woff2"];

module.exports = {
  entry: {
    devtools: path.join(__dirname, "src/devtools.ts"),
    inspector: path.join(__dirname, "src/inspector.tsx"),
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
        exclude: /node_modules/
      },
      {
        exclude: /node_modules/,
        test: /\.scss$/,
        use: [
          {loader: "style-loader"},
          {loader: "css-loader"},
          {loader: "sass-loader"},
        ]
      },
      {
        test: /\.(jpg|png|svg)$/,
        loader: 'url-loader'
      },
      // loads the icon to the dist directory
      {
        test: new RegExp('\.(' + fileExtensions.join('|') + ')$'),
        exclude: /node_modules/,
        loader: "file-loader",
        options: {
          name: '[name].[ext]'
        }
      },
      {
        exclude: /node_modules/,
        test: /\.tsx?$/,
        use: "ts-loader"
      },
      {
        test: /\.html$/,
        loader: "html-loader",
        exclude: /node_modules/
      },
    ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "src/manifest.json",
          transform: function (input, path) {
            // generates the manifest file using the package.json information
            return JSON.stringify({
              description: process.env.npm_package_description,
              version: process.env.npm_package_version,
              ...JSON.parse(input.toString())
            });
          }
        }
      ]
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src/inspector.html"),
      filename: "inspector.html",
      chunks: ["inspector"]
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src/devtools.html"),
      filename: "devtools.html",
      chunks: ["devtools"]
    })
  ],
  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  }
};
