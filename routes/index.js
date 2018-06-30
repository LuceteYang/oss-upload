var express = require('express');
var router = express.Router();
var uploadDir = __dirname + '/../upload';
var formidable = require('formidable');
var fs = require('fs');
var async = require('async');
var sharp = require('sharp');
var OSS = require('ali-oss').Wrapper;
require('dotenv').config()


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express',images: [] });
});

router.post('/upload', function(req, res, next) {
    var form = new formidable.IncomingForm();
    form.encoding = 'utf-8';
    form.uploadDir = uploadDir;
    form.multiples = true;
    form.keepExtensions = true;
    form.parse(req, function (err, fields, files) {
    var output_array = [];
    var file_array;
    if(getType(files.images)==="object"){
        file_array=[files.images];
    }else if(getType(files.images)==="array"){
        file_array=files.images;
    }else if(getType(files.images)==="undefined"){
        file_array=[];
    }
    async.each(file_array, function(item, seconddb) {
    var image_index = file_array.indexOf(item);
    updloadThumbImageFile(item,image_index,function(err,img_url){
        if(err){
            console.log("uploadImages updloadThumbImageFile");
            seconddb(err);
        }else{
        	output_array.push(img_url);
            seconddb(null);
        }
    })
    },function(err){
    	if(err){
    		return res.send('fail');
    	}
    	 res.render('index', { title: 'Express',images: output_array });
    });
});
});

    var updloadThumbImageFile = function(file,image_index, callback) {
    if (!file) {
        console.log("updloadThumbImageFile file not exist");
        return callback("error");
    }
    var filePath = file.path;
    var contentType = file.type;
    if(!contentType.includes("image")){
        console.log("updloadThumbImageFile mime type not allowed type : ",contentType);
        return callback("error");
    }
    if (!fs.existsSync(filePath)) {
        console.log("updloadThumbImageFile file_not_exist ",filePath);
        return callback("file_not_exist");
    }
    var item_key =  'sanghwan/' + new Date().getTime()+image_index;
    var readStream = fs.createReadStream(filePath);
    var client = new OSS({
		    "region": process.env.OSS_REGION,
		    "accessKeyId":process.env.OSS_ACCESS_KEY_ID,
		    "bucket":process.env.OSS_BUCKET,
		    "accessKeySecret":process.env.OSS_ACCESS_KEY_SECRET
		  });
    client
        .put( item_key, readStream)
        .then(function (origin_val) {
        	console.log(origin_val.url);
            var fileurl = origin_val.url;
            fileurl = fileurl.replace("http","https");
            sharp(filePath)
                .resize(394, 295)
                .max()
                .toBuffer(function (err, data, info) {
                    try {
                        fs.unlinkSync(filePath);
                    }catch(err) {
                        console.log('it does not exist filePath',filePath);
                    }
                    if (err) {
                        console.log('updloadThumbImageFile sharp resize error', err);
                        callback("error");
                    } else {
                        var client1 = new OSS({
						    "region": process.env.OSS_REGION,
						    "accessKeyId":process.env.OSS_ACCESS_KEY_ID,
						    "bucket":process.env.OSS_BUCKET,
						    "accessKeySecret":process.env.OSS_ACCESS_KEY_SECRET
						  });
                        client1
                            .put(item_key + "_th", data)
                            .then(function (val) {
                            	console.log(val.url);
                                callback(null, fileurl);
                            })
                            .catch (function (err) {
                                console.log('updloadThumbImageFile Error', err);
                                callback(err);
                            });
                    }
                });
        })
        .catch (function (err) {
            try {
                fs.unlinkSync(filePath);
            }catch(err) {
                console.log('it does not exist filePath',filePath);
            }
            console.log('updloadThumbImageFile S3 Putobject Error', err);
            callback(err);
        });
};

function getType(object) {
    /*
     var abc; => undefined
     var abc  = 1; => number
     var abc  = "string"; => string
     var abc  = {"type":"obj"}; => object
     var abc  = []; => array
     var abc  = true; => boolean
     var abc  = null; => null
     */
    return Object.prototype.toString.call(object).toLowerCase().slice(8, -1);
}

module.exports = router;
