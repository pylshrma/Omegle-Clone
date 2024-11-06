  const socket = io();
            const chatform = document.querySelector("#chatform");
            const messagebox = document.querySelector("#messagebox");
            const messagecontainer = document.querySelector("#message-container");

            let room;

            socket.emit("joinroom");

            socket.on("joined", function (roomname) {
                room = roomname;
                document.querySelector(".nobody").classList.add("hidden");
            })

            socket.on("message", function (message) {
                receiveMessage(message);
            })

            chatform.addEventListener("submit", function (event) {
                event.preventDefault();
                socket.emit("message", { room: room, message: messagebox.value });
                attachMessage(messagebox.value);
                messagebox.value = "";
            })

            function attachMessage(message) {
                const userMessageContainer = document.createElement('div');
                userMessageContainer.classList.add('flex', 'my-2', 'justify-end');

                const userMessageDiv = document.createElement('div');
                userMessageDiv.classList.add('bg-blue-500', 'text-white', 'p-3', 'rounded-lg', 'max-w-xs');

                const userMessageText = document.createElement('p');
                userMessageText.textContent = message;

                userMessageDiv.appendChild(userMessageText);

                userMessageContainer.appendChild(userMessageDiv);

                document.getElementById('message-container').appendChild(userMessageContainer);

                document.querySelector("#message-container").scrollTop = document.querySelector("#message-container").scrollHeight;
            }

            function receiveMessage(message) {
                const messageContainer = document.createElement('div');
                messageContainer.classList.add('flex', 'my-2', 'justify-start');

                const messageDiv = document.createElement('div');
                messageDiv.classList.add('bg-gray-300', 'text-gray-800', 'p-3', 'rounded-lg', 'max-w-xs');

                const messageText = document.createElement('p');
                messageText.textContent = message;

                messageDiv.appendChild(messageText);

                messageContainer.appendChild(messageDiv);

                document.getElementById('message-container').appendChild(messageContainer);
                document.querySelector("#message-container").scrollTop = document.querySelector("#message-container").scrollHeight;
            }

            // WEBRTC START
            let localStream;
            let remoteStream;
            let peerConnection;
            let inCall = false;

            const rtcSettings = {
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            };

            const initialize = async () => {
                socket.on("signalingMessage", handleSignalingMessage);

                try {
                    localStream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: true
                    })
                    document.querySelector("#localVideo").srcObject = localStream;
                    document.querySelector("#localVideo").style.display = "block";

                    initiateOffer();

                    inCall = true;
                }
                catch (err) {
                    console.log("Rejected by browser" + err);
                }
            }

            const initiateOffer = async () => {
                await createPeerConnection();
                try {
                    const offer = await peerConnection.createOffer();
                    await peerConnection.setLocalDescription(offer);
                    socket.emit("signalingMessage", {
                        room,
                        message: JSON.stringify({
                            type: "offer",
                            offer
                        })
                    })
                }
                catch (err) {
                    console.log("error in creating offer" + err);
                }
            }

            const createPeerConnection = () => {
                peerConnection = new RTCPeerConnection(rtcSettings);

                remoteStream = new MediaStream();

                document.querySelector("#remoteVideo").srcObject = remoteStream;
                document.querySelector("#remoteVideo").style.display = "block";
                document.querySelector("#localVideo").classList.add("smallFrame");

                localStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, localStream);
                })

                peerConnection.ontrack = (event) => {
                    event.streams[0].getTracks().forEach(track => {
                        remoteStream.addTrack(track);
                    })
                }

                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        console.log("Sending Ice Candidates");

                        socket.emit("signalingMessage", {
                            room,
                            message: JSON.stringify({
                                type: "candidate",
                                candidate: event.candidate
                            })
                        })
                    }
                }

                peerConnection.onconnectionstatechange = () => {
                    console.log("connection state change hui ", peerConnection.connectionState);
                }
            }

            const handleSignalingMessage = async (message) => {
                const { type, offer, answer, candidate } = JSON.parse(message);
                if (type === "offer") handleOffer(offer);
                if (type === "answer") handleAnswer(answer);
                if (type === "candidate" && peerConnection) {
                    try { await peerConnection.addIceCandidate(candidate); }
                    catch (error) {
                        console.log(error);
                    }
                }
                if (type === "hangup") {
                    hangup()
                }
            }

            const handleOffer = async (offer) => {
                await createPeerConnection();
                try {
                    await peerConnection.setRemoteDescription(offer);
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    socket.emit("signalingMessage", { room, message: JSON.stringify({ type: "answer", answer }) });
                    inCall = true;
                }
                catch (error) {
                    console.log("failed to handle offer");
                }
            }

            const handleAnswer = async (answer) => {
                try {
                    await peerConnection.setRemoteDescription(answer);
                }
                catch (error) {
                    console.log("failed to handle answer");
                }
            }


            document.querySelector("#video-call-btn")
                .addEventListener("click", function () {
                    socket.emit("startVideoCall", { room })
                })

            socket.on("incomingCall", function () {
                console.log("hey");
                document.querySelector("#incoming-call").classList.remove("hidden");
            })

            socket.on("callAccepted", async function () {
               await initialize();
                document.querySelector(".videoblock").classList.remove("hidden");
            })

            document.querySelector("#accept-call")
                .addEventListener("click",async function () {
                    document.querySelector("#incoming-call").classList.add("hidden");
                  await initialize();
                    document.querySelector(".videoblock").classList.remove("hidden");
                    socket.emit("acceptCall", { room })
                })

            document.querySelector("#reject-call")
                .addEventListener("click", function () {
                    document.querySelector("#incoming-call").classList.add("hidden");
                    socket.emit("rejectCall", { room })
                })

            socket.on("callRejected", function () {
                alert("Call rejected by other user");
            })

            document.querySelector("#hangup")
                .addEventListener("click", function () {
                    hangup();
                })

            function hangup() {
                if (peerConnection) {
                    peerConnection.close();
                    peerConnection = null;
                    localStream.getTracks().forEach(track => track.stop());

                    document.querySelector(".videoblock").classList.add("hidden");
                    socket.emit("signalingMessage", { room, message: JSON.stringify({ type: "hangup" }) });
                    inCall = false;
                }
            }