const path = require("path");
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");


var fileExtensions = ["jpg", "jpeg", "png", "gif", "eot", "otf", "svg", "ttf", "woff", "woff2"];

module.exports = {
  entry: {
    devtools: path.join(__dirname, "src/devtools.ts"),
    inspector: path.join(__dirname, "src/inspector.tsx"),
  },
  output: {
    path: path.join(__dirname, "dist"),
    filename: "[name].js"
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        loader: "style-loader!css-loader",
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
        loader: 'url-loader',
        options: {
          limit: 25000,
        },
      },
      {
        exclude: /node_modules/,
        test: /\.tsx?$/,
        use: "ts-loader"
      },
      {
        test: new RegExp('\.(' + fileExtensions.join('|') + ')$'),
        loader: "file-loader?name=[name].[ext]",
        exclude: /node_modules/
      },
      {
        test: /\.html$/,
        loader: "html-loader",
        exclude: /node_modules/
      },
    ]
  },
  plugins: [
    new CleanWebpackPlugin({
      dir: "dist"
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "src/manifest.json",
          transform: function (content, path) {
            // generates the manifest file using the package.json informations
            return Buffer.from(JSON.stringify({
              description: process.env.npm_package_description,
              version: process.env.npm_package_version,
              ...JSON.parse(content.toString())
            }));
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
