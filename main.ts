import * as aesjs from 'aes-js';
import * as QRCode from 'qrcode';
require('./styles.css');

const webSocketUrl = 'wss://services.test.csafe.de/api/registration/wss';

interface ICsafeRegisterData {
    webSocketSessionToken: string;
    qrCodeElementId: string;
    callback: any;
}

interface ICsafeLoginData {
    webSocketSessionToken: string;
    buttonElementId: string;
    action: TCsafeLoginAction;
}

interface TCsafeLoginAction {
    callback?: any;
    forwardPath?: string;
    forwardMethod?: string;
}

interface TCsafeInit {
    webSessionToken?: string;
    csafeButtonElementId: string;
    action: TCsafeLoginAction;
}

let csafeTempUid: any = null,
    aesKey: any = null,
    csafeButton: any,
    csafeAutoFillBtn: any,
    qrCodeOverlay: any;

let enableLogin: boolean = false,
    enableRegister: boolean = false;

let csafeLoginData: ICsafeLoginData, csafeRegisterData: ICsafeRegisterData;

function postForward(path: string, params: any): void {
    let form = document.createElement('form');
    form.setAttribute('method', 'post');
    form.setAttribute('action', path);

    for (let key in params) {
        if (params.hasOwnProperty(key)) {
            var hiddenField = document.createElement('input');
            hiddenField.setAttribute('type', 'hidden');
            hiddenField.setAttribute('name', key);
            hiddenField.setAttribute('value', params[key]);

            form.appendChild(hiddenField);
        }
    }

    document.body.appendChild(form);
    form.submit();
}

function shortId(len: number): string {
    let length = len ? len : 9,
        text = '',
        possible = '23456789ABCDEFGHJKLMNPRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
}

interface IAesKey {
    key: number[];
    counter: number;
}
function getAesKey(): IAesKey {
    let key: number[] = [];
    for (let i = 0; i < 16; i++) {
        key.push(Math.floor(Math.random() * 255));
    }

    return {
        key: key,
        counter: Math.floor(Math.random() * 10),
    };
}

function convertDataURIToBinary(base64: string) {
    let raw = window.atob(base64),
        rawLength = raw.length,
        array = new Uint8Array(new ArrayBuffer(rawLength));

    for (let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }
    return array;
}

function decrypt(base64: string, key: any, aesCounter: number): string {
    //decrypted text in utf8
    console.log(convertDataURIToBinary(base64));
    let encryptedBytes = convertDataURIToBinary(base64), //aesjs.utils.hex.toBytes(hexString),
        aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(aesCounter)),
        decryptedBytes = aesCtr.decrypt(encryptedBytes);

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
}

function csafeButtonClick() {
    if (csafeTempUid === null) {
        csafeButton.innerHTML = `<p class="buttonText">csafe login QR</p> <canvas id="qrCode" style="border-radius: 4px; margin-bottom: 15px;"></canvas>`;

        QRCode.toCanvas(document.getElementById('qrCode'), csafeLoginData.webSocketSessionToken, function(error: any) {
            if (error) console.error(error);
            console.log('success!');
        });
        csafeButton.disabled = true;
        // alert('please use qr code to auth.');
    } else {
        if (csafeLoginData.action.callback !== undefined) {
            csafeLoginData.action.callback({ csafeTempUid: csafeTempUid });
        } else if (csafeLoginData.action.forwardPath !== undefined) {
            postForward(csafeLoginData.action.forwardPath, { csafeTempUid: csafeTempUid });
        } else {
            console.error('click doesnt work, because "csafeLoginData.action" not defined');
        }
    }
}

function getQrCodeContent(webSocketSessionToken: string) {
    let base64String = btoa(String.fromCharCode(...new Uint8Array(aesKey.key)));
    return `${webSocketSessionToken}_${base64String}_${aesKey.counter}`;
}

function loginWebsocket() {
    console.log(`webToken: ${csafeLoginData.webSocketSessionToken}`);
    if ('WebSocket' in window) {
        let ws = new WebSocket(`${webSocketUrl}?token=${csafeLoginData.webSocketSessionToken}&login=yes`);

        ws.onmessage = function(event) {
            let data = JSON.parse(event.data);
            if (data.csafeTempUid !== undefined && data.csafeTempUid !== null) {
                csafeButton.onclick = csafeButtonClick;
                setTimeout(() => {
                    csafeButton.innerHTML = '<p class="buttonText">csafe login OK</p>';
                    // create circle with checkmark animation
                    let loaderContainer = document.createElement('div');
                    loaderContainer.setAttribute('class', 'circle-loader');
                    let checkmark = document.createElement('div');
                    checkmark.classList.add('checkmark', 'draw');
                    loaderContainer.appendChild(checkmark);
                    csafeButton.style.display = 'flex';
                    csafeButton.style.flexDirection = 'row';
                    csafeButton.appendChild(loaderContainer);

                    loaderContainer.classList.add('load-complete');
                    checkmark.style.display = 'block';
                }, 1000);
                csafeTempUid = data.csafeTempUid;
                if (data.forwarding) {
                    // only if connection by app

                    if (csafeLoginData.action.callback !== undefined) {
                        csafeLoginData.action.callback({ csafeTempUid: csafeTempUid });
                    } else if (csafeLoginData.action.forwardPath !== undefined) {
                        postForward(csafeLoginData.action.forwardPath, { csafeTempUid: csafeTempUid });
                    } else {
                        console.error('click doesnt work, because "csafeLoginData.action" not defined');
                    }
                }
            } else {
                csafeButton.innerHTML = `<p class="buttonText">csafe login QR</p>`;
                csafeButton.onclick = csafeButtonClick;
            }
        };
    } else {
        console.error('WebSocket NOT supported by your Browser!');
    }
}

function registerWebsocket() {
    if ('WebSocket' in window) {
        let ws = new WebSocket(`${webSocketUrl}?token=${csafeRegisterData.webSocketSessionToken}`);

        ws.onmessage = function(event) {
            let encryptedRegistrationData = JSON.parse(event.data).encryptedText,
                decryptData = decrypt(encryptedRegistrationData, aesKey.key, aesKey.counter),
                registrationData = JSON.parse(decryptData);

            registrationData.connectionId = JSON.parse(event.data).connectionId;
            csafeRegisterData.callback(registrationData);
        };
        csafeAutoFillBtn.innerHTML = `<p class="buttonText">AutoFill with Csafe</p>`;
        csafeAutoFillBtn.onclick = csafeAutoFillBtnClick;
    } else {
        console.error('WebSocket NOT supported by your Browser!');
    }
}

function csafeAutoFillBtnClick() {
    let qrContent = getQrCodeContent(csafeRegisterData.webSocketSessionToken);
    // console.log(`qrContent: ${qrContent}`);
    qrCodeOverlay = document.createElement('div');
    qrCodeOverlay.setAttribute('class', 'overlay');
    document.body.appendChild(qrCodeOverlay);
    csafeAutoFillBtn.style.border = 'none';
    csafeAutoFillBtn.innerHTML = `<canvas id="qrCodeForAutoFill" height= "150" width= "150"></canvas>`;
    QRCode.toCanvas(document.getElementById('qrCodeForAutoFill'), qrContent, function(error: any) {
        if (error) console.error(error);
        console.log('success!');
    });

    qrCodeOverlay.onclick = csafeHideQrCode;
}

function csafeHideQrCode() {
    qrCodeOverlay.remove();
    csafeAutoFillBtn.style.border = '1px solid #2699fb';
    csafeAutoFillBtn.innerHTML = `<p class="buttonText">AutoFill with Csafe</p>`;
}

function csafeLoginInit(initPara: TCsafeInit) {
    if (initPara.webSessionToken === undefined) {
        console.log('generate webSessionToken, because init without');
    }

    csafeLoginData = {
        webSocketSessionToken: initPara.webSessionToken === undefined ? shortId(24) : initPara.webSessionToken,
        buttonElementId: initPara.csafeButtonElementId,
        action: initPara.action,
    };

    enableLogin = true;
}

function csafeInitRegister(webSessionToken: string | null, qrCodeElementId: string, resultCallback: any) {
    aesKey = getAesKey();
    csafeRegisterData = {
        webSocketSessionToken: webSessionToken === null ? shortId(24) : webSessionToken,
        qrCodeElementId: qrCodeElementId,
        callback: resultCallback,
    };

    enableRegister = true;
}

const csafe = {
    loginInit: csafeLoginInit,
    csafeInitRegister: csafeInitRegister,
};

document.addEventListener(
    'DOMContentLoaded',
    function() {
        if (enableLogin) {
            csafeButton = document.getElementById(csafeLoginData.buttonElementId);
            csafeButton.setAttribute('class', 'csafeBtn');
            csafeButton.innerHTML = ` <div class="init-loader" id="initLoader"></div>`;
            loginWebsocket();
        }

        if (enableRegister) {
            csafeAutoFillBtn = document.getElementById(csafeRegisterData.qrCodeElementId);
            csafeAutoFillBtn.setAttribute(
                'style',
                'margin: 10px 0; ' +
                'background-color: white; ' +
                'color: #2699fb; ' +
                'width: 164px; ' +
                'border: 1px solid #2699fb; ' +
                'border-radius: 4px; ' +
                'display: flex; ' +
                'flex-direction: column; ' +
                'justify-content: center; ' +
                'outline: none; ' +
                'cursor: pointer; ' +
                'align-items: center;',
            );
            registerWebsocket();
        }
    },
    false,
);

//exports.csafe = csafe;
module.exports = csafe;
