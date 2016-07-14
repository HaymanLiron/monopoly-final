var Monopoly = {};
Monopoly.allowRoll = true; //boolean variable to prevent dice rolling while turn is being processed
Monopoly.moneyAtStart = 200;
Monopoly.doubleCounter = 0;

Monopoly.init = function(){
    $(document).ready(function(){
        Monopoly.adjustBoardSize(); //sets board size responsively
        $(window).bind("resize",Monopoly.adjustBoardSize); //whenever window is adjusted, board size is recalculated
        Monopoly.initDice();
        Monopoly.initPopups();
        Monopoly.start();        
    });
};

Monopoly.start = function(){
    Monopoly.showPopup("intro"); //intro popup that asks how many players
};

Monopoly.initDice = function(){
    //only make the dice clickable if the Monopoly.allowRoll boolean is true
    $(".dice").click(function(){
        if (Monopoly.allowRoll){
            Monopoly.rollDice();
        }
    });
};

Monopoly.getCurrentPlayer = function(){
    return $(".player.current-turn");
};

Monopoly.getPlayersCell = function(player){
    return player.closest(".cell");
};

Monopoly.getPlayersMoney = function(player){
    return parseInt(player.attr("data-money"));
};

Monopoly.handleGoBroke = function (player) {
    var brokePlayerId = player.attr("id");
    //remove player's ownership from any properties, and make them available
    $(".property." + brokePlayerId)
        .removeClass(brokePlayerId)
        .addClass("available");
    //before we remove this player from the game, we have to set the turn for the next player
    Monopoly.setNextPlayerTurn();
    //now we can remove the broke player from the game
    $("#" + brokePlayerId).remove();
};

Monopoly.updatePlayersMoney = function(player,amount){
    //this function subtracts amount from the player's current money
    var playersMoney = parseInt(player.attr("data-money"));
    playersMoney -= amount;
    if (playersMoney < 0){ //player is broke
        Monopoly.handleGoBroke(player);
    }
    //store the player's money in HTML
    player.attr("data-money",playersMoney);
    player.attr("title",player.attr("id") + ": $" + playersMoney);
    Monopoly.playSound("chaching", "wav");
};

Monopoly.dice1num = 1;
Monopoly.dice2num = 1;

Monopoly.rollDice = function(){
    var currentPlayer = Monopoly.getCurrentPlayer();
    //get results for each dice
    Monopoly.dice1num =3;// Math.floor(Math.random() * 6) + 1 ;
    Monopoly.dice2num =3;// Math.floor(Math.random() * 6) + 1 ;
    //clear dots from dice
    $(".dice").find(".dice-dot").css("opacity",0);
    //
    $(".dice#dice1").attr("data-num",Monopoly.dice1num).find(".dice-dot.num" + Monopoly.dice1num).css("opacity",1);
    $(".dice#dice2").attr("data-num",Monopoly.dice2num).find(".dice-dot.num" + Monopoly.dice2num).css("opacity",1);
    if (Monopoly.dice1num == Monopoly.dice2num){
        //player rolled doubles
        Monopoly.doubleCounter++;
        if (Monopoly.doubleCounter >= 3){//go straight to jail
            Monopoly.handleGoToJail(currentPlayer);
            return;
        }
    }
    Monopoly.handleAction(currentPlayer,"move",Monopoly.dice1num + Monopoly.dice2num);
};


Monopoly.movePlayer = function(player,steps){
    //disable dice rolling while piece is moving
    Monopoly.allowRoll = false;
    var playerMovementInterval = setInterval(function(){
        //move the piece one square every 200 milliseconds
        //until there are no more steps to take
        if (steps == 0){
            clearInterval(playerMovementInterval);
            //player has ended at this square, now handle what they do
            Monopoly.handleTurn(player);
        }else{
            //move player to next square
            var playerCell = Monopoly.getPlayersCell(player);
            var nextCell = Monopoly.getNextCell(playerCell);
            nextCell.find(".content").append(player);
            steps--;
        }
    },200);
};

Monopoly.handleTurn = function(){
    //work out what the player needs to do at the square that he just landed on
    var player = Monopoly.getCurrentPlayer();
    var playerCell = Monopoly.getPlayersCell(player);
    if (playerCell.is(".available.property")){ //can buy this property
        Monopoly.handleBuyProperty(player,playerCell);
    }else if(playerCell.is(".property:not(.available)") && !playerCell.hasClass(player.attr("id"))){ //another player owns this property
         Monopoly.handlePayRent(player,playerCell);
    }else if(playerCell.is(".go-to-jail")){ //go to jail square
        Monopoly.handleGoToJail(player);
    }else if(playerCell.is(".chance")){ //chance square
        Monopoly.handleChanceCard(player);
    }else if(playerCell.is(".community")){ //community chest square
        Monopoly.handleCommunityCard(player);
    }else{ //nothing needs to be done
        Monopoly.setNextPlayerTurn();
    }
};

Monopoly.setNextPlayerTurn = function(){
    //work out who the next player to have a turn is, and allow them to have a turn
    var currentPlayerTurn = Monopoly.getCurrentPlayer();
    var playerId = parseInt(currentPlayerTurn.attr("id").replace("player",""));
    var nextPlayerId;
    if (Monopoly.dice1num == Monopoly.dice2num && Monopoly.doubleCounter < 3){//user rolled double less than 3 times and can go again.
        // Note that we let him go again, even if he ended in jail
        nextPlayerId = playerId;
    } else { //old player did not roll a double, so new player's turn
        nextPlayerId = playerId + 1;
        if (nextPlayerId > $(".player").length){ //we need to start back at player 1
            nextPlayerId = 1;
        }
        //reset doubleCounter because it's a new turn
        Monopoly.doubleCounter = 0;
    }

    //give "current-turn" class to the correct player now
    currentPlayerTurn.removeClass("current-turn");
    var nextPlayer = $(".player#player" + nextPlayerId);
    nextPlayer.addClass("current-turn");
    if (nextPlayer.is(".jailed")){ //next player is in jail now, we have to check if they can leave
        var currentJailTime = parseInt(nextPlayer.attr("data-jail-time"));
        currentJailTime++;
        nextPlayer.attr("data-jail-time",currentJailTime);
        if (currentJailTime > 3){ //they can leave jail now
            nextPlayer.removeClass("jailed");
            nextPlayer.removeAttr("data-jail-time");
        } 
        Monopoly.setNextPlayerTurn(); //call this function again to work out next player to have a turn
        return;
    }
    Monopoly.closePopup();
    Monopoly.allowRoll = true; //allow access to the dice now
};

Monopoly.handleBuyProperty = function(player,propertyCell){
    //if player landed on a property that has not been purchased yet, they can buy it now if they want
    var propertyCost = Monopoly.calculatePropertyCost(propertyCell); //get the property cost
    var popup = Monopoly.getPopup("buy"); 
    popup.find(".cell-price").text(propertyCost);
    //set up event listeners for the yes/no buttons on the popups
    popup.find("button").unbind("click").bind("click",function(){
        var clickedBtn = $(this);
        if (clickedBtn.is("#yes")){ //player wants to buy the property
            Monopoly.handleBuy(player,propertyCell,propertyCost);
        }else{ //player doesn't want to buy the property
            Monopoly.closeAndNextTurn();
        }
    });
    Monopoly.showPopup("buy");
};

Monopoly.handlePayRent = function(player,propertyCell){
    //player landed on another player's property and needs to pay rent!
    var popup = Monopoly.getPopup("pay");
    var currentRent = parseInt(propertyCell.attr("data-rent")); //get rent cost
    var propertyOwnerId = propertyCell.attr("data-owner"); //find owner
    popup.find("#player-placeholder").text(propertyOwnerId);
    popup.find("#amount-placeholder").text(currentRent);
    popup.find("button").unbind("click").bind("click",function(){
        //manage payment of rent
        var propertyOwner = $(".player#"+ propertyOwnerId);
        Monopoly.updatePlayersMoney(player,currentRent);
        Monopoly.updatePlayersMoney(propertyOwner,-1*currentRent);
        Monopoly.closeAndNextTurn();
    });
   Monopoly.showPopup("pay");
};


Monopoly.handleGoToJail = function(player){
    //user needs to go to jail, set up a popup informing user of this, and when they click OK, send them to jail
    var popup = Monopoly.getPopup("jail");
    popup.find("button").unbind("click").bind("click",function(){
        Monopoly.handleAction(player,"jail");
    });
    Monopoly.showPopup("jail");
};


Monopoly.handleChanceCard = function(player){
    //user needs to receive a chance card
    var popup = Monopoly.getPopup("chance");
    popup.find(".popup-content").addClass("loading-state");
    //call the server to get a random chance card
    $.get("https://itcmonopoly.appspot.com/get_random_chance_card", function(chanceJson){
        popup.find(".popup-content #text-placeholder").text(chanceJson["content"]);
        popup.find(".popup-title").text(chanceJson["title"]);
        popup.find(".popup-content").removeClass("loading-state");
        popup.find(".popup-content button").attr("data-action",chanceJson["action"]).attr("data-amount",chanceJson["amount"]);
    },"json");
    //when user clicks OK, do the appropriate action that the card requires
    popup.find("button").unbind("click").bind("click",function(){
        var currentBtn = $(this);
        var action = currentBtn.attr("data-action");
        var amount = currentBtn.attr("data-amount");
        Monopoly.handleAction(player,action,amount);
    });
    Monopoly.showPopup("chance");
};

Monopoly.handleCommunityCard = function(player){
    //user needs to receive a community chest card
    var popup = Monopoly.getPopup("community");
    popup.find(".popup-content").addClass("loading-state");
    //call the server to get a random community chest card
    $.get("https://itcmonopoly.appspot.com/get_random_community_card", function(communityJson){
        popup.find(".popup-content #text-placeholder").text(communityJson["content"]);
        popup.find(".popup-title").text(communityJson["title"]);
        popup.find(".popup-content").removeClass("loading-state");
        popup.find(".popup-content button").attr("data-action",communityJson["action"]).attr("data-amount",communityJson["amount"]);
    },"json");
    //when user clicks OK, do the appropriate action that the card requires
    popup.find("button").unbind("click").bind("click",function(){
        var currentBtn = $(this);
        var action = currentBtn.attr("data-action");
        var amount = currentBtn.attr("data-amount");
        Monopoly.handleAction(player,action,amount);
    });
    Monopoly.showPopup("community");
};

Monopoly.sendToJail = function(player){
    //send the player to jail
    player.addClass("jailed");
    $('.player#' + player.title + ":after").css('display', 'inline-block');
    player.attr("data-jail-time",1); //attribute that keeps track of how many turns user has been in jail
    $(".corner.game.cell.in-jail").append(player); //move him to the jail square
    Monopoly.playSound("woopwoop", "wav");
    Monopoly.setNextPlayerTurn();
    Monopoly.closePopup();
};


Monopoly.getPopup = function(popupId){
    return $(".popup-lightbox .popup-page#" + popupId);
};

Monopoly.calculatePropertyCost = function(propertyCell){
    //properties are divided into different groups, titled groupX
    //cost of property is X * 5
    //unless it is a railway, and then the price is fixed at 10
    var cellGroup = propertyCell.attr("data-group");
    var cellPrice = parseInt(cellGroup.replace("group","")) * 5;
    if (cellGroup == "rail"){
        cellPrice = 10;
    }
    return cellPrice;
};

Monopoly.calculatePropertyRent = function(propertyCost){
    //rent is half the property cost, rounded down, we don't want to deal with cents
    return Math.floor(propertyCost/2);
};


Monopoly.closeAndNextTurn = function(){
    //close the popup and move to the next player's turn
    Monopoly.setNextPlayerTurn();
    Monopoly.closePopup();
};

Monopoly.initPopups = function(){
    //popup that appears at the beginning of the game to ask the user how many players he wants
    $(".popup-page#intro").find("button").click(function(){
        var numOfPlayers = $(this).closest(".popup-page").find("input").val();
        if (Monopoly.isValidInput(numOfPlayers)){
            Monopoly.createPlayers(numOfPlayers);
            Monopoly.closePopup();
        }
    });
};

Monopoly.handleBuy = function(player,propertyCell,propertyCost){
    //if player lands on a property that is not currently owned, and he wants to buy it
    var playersMoney = Monopoly.getPlayersMoney(player);
    if (playersMoney < propertyCost){ //if he can't afford it, he can't buy it
        Monopoly.playSound("nomoney","mp3");
        Monopoly.showErrorMsg();
    }else{ //he can afford it and wants to buy it
        Monopoly.updatePlayersMoney(player,propertyCost);
        var rent = Monopoly.calculatePropertyRent(propertyCost);
        //add data of owner, availability and rent cost to the element
        propertyCell.removeClass("available")
                    .addClass(player.attr("id"))
                    .attr("data-owner",player.attr("id"))
                    .attr("data-rent",rent);
        Monopoly.setNextPlayerTurn();
    }
};

Monopoly.handleAction = function(player,action,amount){
    //function that handles different actions that may need to be done by the player
    switch(action){
        case "move":
            Monopoly.movePlayer(player,amount);
             break;
        case "pay":
            Monopoly.updatePlayersMoney(player,amount);
            Monopoly.setNextPlayerTurn();
            break;
        case "jail":
            Monopoly.sendToJail(player);
            break;
    }
    Monopoly.closePopup();
};

Monopoly.createPlayers = function(numOfPlayers){
    //creates the players at the beginning of the game
    var startCell = $(".go");
    for (var i=1; i<= numOfPlayers; i++){
        var player = $("<div />").addClass("player shadowed").attr("id","player" + i).attr("title","player" + i + ": $" + Monopoly.moneyAtStart);
        startCell.find(".content").append(player);
        if (i==1){ //first player, it will be his turn
            player.addClass("current-turn");
        }
        player.attr("data-money",Monopoly.moneyAtStart);
    }
};

Monopoly.getNextCell = function(cell){
    //works out what the next cell in the board is, remembering that after cell 40, we go back to cell 1
    var currentCellId = parseInt(cell.attr("id").replace("cell",""));
    var nextCellId = currentCellId + 1;
    if (nextCellId > 40){
        Monopoly.handlePassedGo();
        nextCellId = 1;
    }
    return $(".cell#cell" + nextCellId);
};

Monopoly.handlePassedGo = function(){
    var player = Monopoly.getCurrentPlayer();
    //money passed into next function is negative because the parameter passed in is subtracted,
    // also we use Math.floor to not have to deal with decimals
    Monopoly.updatePlayersMoney(player, -1*Math.floor(Monopoly.moneyAtStart/10));
};

Monopoly.isValidInput = function(input){
    var isValid = false;
    var re = /^[1-4]$/; //regex for only numbers 1,2,3,4
    if (re.test(input)){ //input was 1, 2, 3 or 4
            isValid = true;
            return isValid;
    } else { //input is not valid
        Monopoly.showErrorMsg();
        return isValid;
    }
};

Monopoly.showErrorMsg = function(){
    $(".popup-page .invalid-error").fadeTo(500,1);
    setTimeout(function(){
            $(".popup-page .invalid-error").fadeTo(500,0);
    },2000);
};


Monopoly.adjustBoardSize = function(){
    //when window is resized we call this function to make the board smaller and still fit the screen
    var gameBoard = $(".board");
    var boardSize = Math.min($(window).height(),$(window).width());
    boardSize -= parseInt(gameBoard.css("margin-top")) *2;
    gameBoard.css({"height":boardSize,"width":boardSize});
};

Monopoly.closePopup = function(){
    $(".popup-lightbox").fadeOut();
};

Monopoly.playSound = function(sound, extension) {
    //function that plays sounds
    var snd = new Audio("./sounds/" + sound + "." + extension);
    snd.play();
};

Monopoly.showPopup = function(popupId){
    $(".popup-lightbox .popup-page").hide();
    $(".popup-lightbox .popup-page#" + popupId).show();
    $(".popup-lightbox").fadeIn();
};

Monopoly.init();