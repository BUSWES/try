/*jshint esversion:6*/

$(function () {
    const video = $("#video")[0];
    const alertSound = $("#alert-sound")[0];
    var model;
    var previousState = "";

    var publishable_key = "rf_XSwv6abPx3PR6M5DX906MV4aG342";
    var toLoad = {
        model: "self-detaction",
        version: 1
    };

    const loadModelPromise = new Promise(function (resolve, reject) {
        roboflow
            .auth({
                publishable_key: publishable_key
            })
            .load(toLoad)
            .then(function (m) {
                model = m;
                resolve();
            });
    });

    loadModelPromise.then(function () {
        $("body").removeClass("loading");
        startVideoStream();
    });

    var canvas, ctx;
    const font = "16px sans-serif";

    function startVideoStream() {
        navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { exact: "environment" } // Use the back camera
            },
            audio: false
        })
        .then(function (stream) {
            video.srcObject = stream;
            video.onloadeddata = function () {
                video.play();
                resizeCanvas();
                detectFrame();
            };
        })
        .catch(function (err) {
            console.error("Error accessing the camera: " + err);
        });
    }

    function videoDimensions(video) {
        var videoRatio = video.videoWidth / video.videoHeight;
        var width = video.offsetWidth,
            height = video.offsetHeight;
        var elementRatio = width / height;
        if (elementRatio > videoRatio) {
            width = height * videoRatio;
        } else {
            height = width / videoRatio;
        }
        return {
            width: width,
            height: height
        };
    }

    $(window).resize(function () {
        resizeCanvas();
    });

    const resizeCanvas = function () {
        $("canvas").remove();

        canvas = $("<canvas/>");

        ctx = canvas[0].getContext("2d");

        var dimensions = videoDimensions(video);

        console.log(
            video.videoWidth,
            video.videoHeight,
            video.offsetWidth,
            video.offsetHeight,
            dimensions
        );

        canvas[0].width = video.videoWidth;
        canvas[0].height = video.videoHeight;

        canvas.css({
            width: dimensions.width,
            height: dimensions.height,
            left: ($(window).width() - dimensions.width) / 2,
            top: ($(window).height() - dimensions.height) / 2
        });

        $("body").append(canvas);
    };

    const renderPredictions = function (predictions) {
        var dimensions = videoDimensions(video);

        var scale = 1;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        var currentState = "";

        predictions.forEach(function (prediction) {
            const x = prediction.bbox.x;
            const y = prediction.bbox.y;

            const width = prediction.bbox.width;
            const height = prediction.bbox.height;

            ctx.strokeStyle = prediction.color;
            ctx.lineWidth = 4;
            ctx.strokeRect(
                (x - width / 2) / scale,
                (y - height / 2) / scale,
                width / scale,
                height / scale
            );

            ctx.fillStyle = prediction.color;
            const textWidth = ctx.measureText(prediction.class).width;
            const textHeight = parseInt(font, 10);
            ctx.fillRect(
                (x - width / 2) / scale,
                (y - height / 2) / scale,
                textWidth + 8,
                textHeight + 4
            );

            if (prediction.class === "red-sign") {
                currentState = "red";
            } else if (prediction.class === "green-sign") {
                currentState = "green";
            }
        });

        predictions.forEach(function (prediction) {
            const x = prediction.bbox.x;
            const y = prediction.bbox.y;

            const width = prediction.bbox.width;
            const height = prediction.bbox.height;

            ctx.font = font;
            ctx.textBaseline = "top";
            ctx.fillStyle = "#000000";
            ctx.fillText(
                prediction.class,
                (x - width / 2) / scale + 4,
                (y - height / 2) / scale + 1
            );
        });

        console.log(`Previous state: ${previousState}, Current state: ${currentState}`);

        if (previousState === "red" && currentState === "green") {
            console.log("Playing sound!");
            alertSound.play().catch(function (error) {
                console.log("Error playing sound: ", error);
            });
        }

        previousState = currentState;
    };

    var prevTime;
    var pastFrameTimes = [];
    const detectFrame = function () {
        if (!model) return requestAnimationFrame(detectFrame);

        model
            .detect(video)
            .then(function (predictions) {
                requestAnimationFrame(detectFrame);
                renderPredictions(predictions);
                console.log(predictions); // Log predictions to the console

                if (prevTime) {
                    pastFrameTimes.push(Date.now() - prevTime);
                    if (pastFrameTimes.length > 30) pastFrameTimes.shift();

                    var total = 0;
                    _.each(pastFrameTimes, function (t) {
                        total += t / 1000;
                    });

                    var fps = pastFrameTimes.length / total;
                    $("#fps").text(Math.round(fps));
                }
                prevTime = Date.now();
            })
            .catch(function (e) {
                console.log("CAUGHT", e);
                requestAnimationFrame(detectFrame);
            });
    };

    // Ensure audio can play on mobile devices
    document.body.addEventListener('click', function() {
        alertSound.play().catch(function (error) {
            console.log("Audio play prevented: ", error);
        });
    }, { once: true });
});
