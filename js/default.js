﻿// HTML5 Pong Game Template 
// Mickey MacDonald 2013
(function () {
    "use strict";

    WinJS.Binding.optimizeBindingReferences = true;

    var app = WinJS.Application;
    var activation = Windows.ApplicationModel.Activation;

    var canvas; //Will be linked to the canvas in our default.html page
    var stage; //Is the equivalent of stage in AS3; we'll add "children" to it
    var ctx;

    // Game States 
    var gameStates = {
        "Start" : 1,
        "Playing" : 2,
        "GameOver": 3,
        "Paused": 4,
    };

    var currentGameState; // Keeps track of our current game state

    // Graphics //
    var backgroundImage, backgroundBitmap; 
    var snakeBodyImage, snakeBodyBitmap; 
    var foodImage, foodBitmap;
    var winImage, winBitmap; //The winning popup
    var loseImage, loseBitmap; //The losing popup
    var pausedImage, pausedBitmap; //The Image we show when paused

    // Variables //
    var title; //The games title
    var score; //The main player score
    var cellWidth; //set this later for easy control
    var direction;
    var food;
    var score;

    //Snake Array for the cells
    var snakeArray;

    var previousClick;
    var pauseNeeded = false;
   

    //Calculate display scale factor
    var SCALE_X = 4;
    var SCALE_Y = 4;
    var MARGIN = 25; //Inset from edge of screen

    // Preloader 
    var preload;
    var manifest;

    //SoundJS
    var soundManifest;
    

    app.onactivated = function (args) {
        if (args.detail.kind === activation.ActivationKind.launch) {
            if (args.detail.previousExecutionState !== activation.ApplicationExecutionState.terminated) {
                // TODO: This application has been newly launched. Initialize
                // your application here.
                initialize();
            } else {
                // TODO: This application has been reactivated from suspension.
                // Restore application state here.
            }
            args.setPromise(WinJS.UI.processAll());
        }
    };

    


    function initialize() {
        canvas = document.getElementById("gameCanvas"); // link our canvas to the one in default.html
        canvas.width = window.innerWidth; // Set the canvas width
        canvas.height = window.innerHeight; // Set the canvas height
        ctx = canvas.getContext("2d");

        stage = new createjs.Stage(canvas); // This creates our stage on the canvas

        // Use PreloadJS to make sure sound & images are loaded
        // before we begin using them this is especially
        // important for large or remote resources
        preload = new createjs.LoadQueue();
        preload.installPlugin(createjs.Sound)

        preload.loadManifest([
                            //Images 
                            { src: "Assets/pause.png", id: "paused" },
                            { src: "Assets/snakeBody.png", id: "snakeBody" },
                            { src: "Assets/win.png", id: "win" },
                            { src: "Assets/lose.png", id: "lose" },
                            { src: "Assets/grass.png", id: "bg" },
                            { src: "Assets/snakeFood.png", id: "food" },
                            //Sounds
                            { src: "Assets/playerScore.mp3", id: "playerScore" },
                            { src: "Assets/enemyScore.mp3", id: "enemyScore" },
                            { src: "Assets/hit.mp3", id: "hit" },
                            { src: "Assets/wall.mp3", id: "wall" }
        ]);
        preload.addEventListener("complete", prepareGame);

        //Add our listener to check for state changes in the view, like snap view
        window.addEventListener("resize", onViewStateChanged);
    }


    // This function will setup our game
    // This is where we assign our varibles and add objects to the stage
    function prepareGame() {

        //Score
        score = 0;

        // Set the current state to 'Start'
        currentGameState = gameStates.Start;

        // Setup the win/lose and paused graphics
        // We will add them to the stage when needed
        winImage = preload.getResult("win"); // This is how we get the image from preloader
        winBitmap = new createjs.Bitmap(winImage); // This will create a bitmap from our image
        winBitmap.scaleX = SCALE_X; // Scaling our bitmap
        winBitmap.scaleY = SCALE_Y;

        loseImage = preload.getResult("lose");
        loseBitmap = new createjs.Bitmap(loseImage);
        loseBitmap.scaleX = SCALE_X;
        loseBitmap.scaleY = SCALE_Y;

        pausedImage = preload.getResult("paused");
        pausedBitmap = new createjs.Bitmap(pausedImage);
        pausedBitmap.scaleX = SCALE_X *2;
        pausedBitmap.scaleY = SCALE_Y *2;

        snakeBodyImage = preload.getResult("snakeBody");
        //snakeBodyBitmap = new createjs.Bitmap(snakeBodyImage);
        
        backgroundImage = preload.getResult("bg");
        backgroundBitmap = new createjs.Bitmap(backgroundImage);
        backgroundBitmap.scaleX = 2;
        backgroundBitmap.scaleY = 2;
        stage.addChild(backgroundBitmap);

        foodImage = preload.getResult("food");
        //foodBitmap = new createjs.Bitmap(foodImage);
       
        cellWidth = snakeBodyImage.width;
        direction = "right"; //default direction
        createSnake();
        createFood();
        startGame(); // Run our startGame function
    }
    

    function startGame() {
        createjs.Ticker.setFPS(15); // Set the tick rate of our update timer
        createjs.Ticker.addListener(gameLoop); // Add a listener to call our gameloop on every tick
    }

    // Our gameloop, I have broke it into two parts. This is to make it a little easier to read and understand.
    function gameLoop() {
        update();
        draw();
    }



    // The update, this is where our game logic lives
    function update() {

        // Our game state switch
        switch (currentGameState) {

            // The code below is ran while the game is in the 'Start' state
            case gameStates.Start: 

                stage.onClick = null; //This nulls any click input

                // Check for a touch or click
                 stage.onClick = function (e) {
                        previousClick = e;
                        direction = "right";
                        currentGameState = gameStates.Playing; // Switch states to playing
                }
                break;

            // The code below is ran while the game is in the 'Playing' state
            case gameStates.Playing:
                display("clear"); //Clear any overlays on screen
                playGame();  // Moved the game play logic code to keep the update easy to read
                break;

            // The code below is ran while the game is in the 'Game Over' state
            case gameStates.GameOver:
                // Check for a touch or click
                stage.onClick = function () {
                    // Clear the scores if any exist
                    score = 0;
                   // cpuScore.text = 0;
                    display('clear'); // This will clear all the overlays
                    reset();
                    previousClick = null;
                    currentGameState = gameStates.Start; // Switch states to start
                }
                break;
            case gameStates.Paused:
                display("paused"); //Display the paused overlay
                stage.onClick = function (e) {
                    if (pauseNeeded == false) {
                        previousClick = e;
                        currentGameState = gameStates.Playing; // Switch states to playing
                    }
                }
                

                break;

                
        }        
    }

    // Our draw function
    function draw() {
    
        stage.update();

        //the score
        var score_text = "Score: " + score;
        ctx.font = 'Italic 60px Sans-Serif';
        ctx.fillStyle = "white";
        ctx.fillText(score_text, 80, 140);

        //the title
        var titleText = "Hungry Snake";
        ctx.font = 'Bold 80px Sans-Serif';
        ctx.fillStyle = "white";
        ctx.fillText(titleText, 80, 80);

        if (currentGameState == gameStates.Start) {
            //Instructions
            var newtext = "Click or Tap in the direction you want the snake to move";
            ctx.font = 'Bold 80px Sans-Serif';
            ctx.fillStyle = "white";
            ctx.fillText(newtext, canvas.width / 4, canvas.height / 2, 1000);
        }


        for (var i = 0; i < snakeArray.length; i++) {
            var c = snakeArray[i];
            drawCell(c.x, c.y);
        }

        drawFood(food.x, food.y);
        
    }


    // The gameplay logic, moved to its own function to make it easier to read
    function playGame() {

        stage.onClick = moveSnake;        

        var nx = snakeArray[0].x;
        var ny = snakeArray[0].y;


        if(direction == "right") nx++;
        else if (direction == "left") nx--;
        else if (direction == "up") ny--;
        else if (direction == "down") ny++;
        

        
        if (nx == -1 || nx == canvas.width / cellWidth || ny == -1 || ny == canvas.height / cellWidth || checkCollision(nx, ny, snakeArray)) {
            //game over
            display("lose");
            currentGameState = gameStates.GameOver;
            return;
        }

        if (nx == food.x && ny == food.y) {
            var tail = { x: nx, y: ny };
            score++;
            createFood();
        }
        else {
            var tail = snakeArray.pop(); 
            tail.x = nx; tail.y = ny;
        }
        snakeArray.unshift(tail); 

        

       
    }

    function moveSnake(e) {

        if (e.stageY > previousClick.stageY && direction != "up") {
            direction = "down";
            previousClick = e;
        }
        if (e.stageY < previousClick.stageY && direction != "down") {
            direction = "up";
            previousClick = e;
        }
        if (e.stageX > previousClick.stageX && direction != "left") {
            direction = "right";
            previousClick = e;
        }
        if (e.stageX < previousClick.stageX && direction != "right") {
            direction = "left";
            previousClick = e;
        }
        
        
    }

    // Reset, this will set the paddle and ball to their starting place
    function reset() {
        
            stage.onClick = null; // Clears movement input
            createSnake();        
    }


    // This function will display our overlays and clear them when needed
    function display(e) {
        
        stage.onMouseMove = null;

        switch (e) {
            case 'win':
                winBitmap.x = (canvas.width * 0.5) - (winImage.width * 2);
                winBitmap.y = (canvas.height * 0.5) - (winImage.height * 2);
                stage.addChild(winBitmap);
                e = null;
                currentGameState = gameStates.GameOver;
                break;


            case 'lose':
                loseBitmap.x = (canvas.width * 0.5) - (winImage.width * 2);
                loseBitmap.y = (canvas.height * 0.5) - (winImage.height * 2);
                e = null;
                stage.addChild(loseBitmap);
 
                currentGameState = gameStates.GameOver;
                break;

            case 'paused':
                pausedBitmap.x = 60;
                pausedBitmap.y = 500;
                e = null;
                stage.addChild(pausedBitmap);
                break;

            case 'clear':
                e = null;
                stage.removeChild(loseBitmap);
                stage.removeChild(winBitmap);
                stage.removeChild(pausedBitmap);
                break;
        }
    }

    
    function createSnake() {
        var length = 5; 
        snakeArray = []; 
        for (var i = length - 1; i >= 0; i--) {
            snakeArray.push({ x: i, y: 0 })
        }
    }

    function createFood() {
        food = {
            x: Math.round(Math.random() * (canvas.width - cellWidth) / cellWidth),
            y: Math.round(Math.random() * (canvas.height - cellWidth) / cellWidth),
        };
    }

    
    function drawCell(x, y) {
        ctx.fillStyle = ctx.createPattern(snakeBodyImage, 'repeat')
        ctx.fillRect(x * cellWidth, y * cellWidth, cellWidth, cellWidth);
        ctx.strokeStyle = "white";
        ctx.strokeRect(x * cellWidth, y * cellWidth, cellWidth, cellWidth);
    }

    function drawFood(x, y) {
        ctx.fillStyle = ctx.createPattern(foodImage, 'repeat')
        ctx.fillRect(x * cellWidth, y * cellWidth, cellWidth, cellWidth);
        ctx.strokeStyle = "white";
        ctx.strokeRect(x * cellWidth, y * cellWidth, cellWidth, cellWidth);
    }

    function checkCollision(x, y, array) {
        for (var i = 0; i < array.length; i++) {
            if (array[i].x == x && array[i].y == y)
                return true;
        }
        return false;
    }
		
		

    //This Function will check if the view state is snapped. 
    //If it is we set our gamestate to paused. 
    function onViewStateChanged() {
        var viewStates = Windows.UI.ViewManagement.ApplicationViewState, msg;
        var newViewState = Windows.UI.ViewManagement.ApplicationView.value;

        if (newViewState === viewStates.snapped) {
            currentGameState = gameStates.Paused;
            pauseNeeded = true;
        }
        if (newViewState != viewStates.snapped) {
            
            pauseNeeded = false;
        }
    }

    app.oncheckpoint = function (args) {
        // TODO: This application is about to be suspended. Save any state
        // that needs to persist across suspensions here. You might use the
        // WinJS.Application.sessionState object, which is automatically
        // saved and restored across suspension. If you need to complete an
        // asynchronous operation before your application is suspended, call
        // args.setPromise().
    };

    document.addEventListener("DOMContentLoaded", initialize, false);

    app.start();
})();
