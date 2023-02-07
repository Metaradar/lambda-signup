// metaradar.io | Signup Lambda function
// This file is part of the metardar.io project.
// Author: Ralph Kuepper
// Contact: info@metaradar.io
// License: MIT

const mysql = require('mysql2/promise');
const AWS = require('aws-sdk');

AWS.config.update({
    accessKeyId: process.env.AWS_AKEY,
    secretAccessKey: process.env.AWS_SKEY,
    region: 'us-east-1'
});

function randomString(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

var emailRegex = /^[-!#$%&'*+\/0-9=?A-Z^_a-z{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;

function isEmailValid(email) {
    if (!email)
        return false;

    if (email.length > 254)
        return false;

    var valid = emailRegex.test(email);
    if (!valid)
        return false;

    var parts = email.split("@");
    if (parts[0].length > 64)
        return false;

    var domainParts = parts[1].split(".");
    if (domainParts.some(function (part) { return part.length > 63; }))
        return false;

    return true;
}

exports.handler = async function (event, context) {
    let request = event;
    let data = JSON.parse(request.body);
    let network = "ethereum";
    if (data.network) {
        network = data.network;
    }

    if (!isEmailValid(data.email)) {
        return {
            "success": false,
            "error": "invalid email"
        }
    }
    if (data.address.length != 42) {
        return {
            "success": false,
            "error": "invalid address"
        }
    }

    var con = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DB
    });

    let res = await con.execute("SELECT * FROM addresses WHERE address = ? AND email = ? AND network = ?", [data.address, data.email, network]);

    if (res[0].length == 0) {
        let code = randomString(10);
        var sql = "INSERT INTO addresses (address, network, email, emailCode, createdAt) VALUES(?, ?, ?, ?, NOW())";
        await con.execute(sql, [data.address, network, data.email, code]);

        var params = {
            Destination: {
                ToAddresses: [
                    data.email,
                ]
            },
            Message: {
                Body: {
                    Html: {
                        Charset: "UTF-8",
                        Data: "Please validate this email: https://metaradar.io/activate/" + code
                    },
                    Text: {
                        Charset: "UTF-8",
                        Data: "Please validate this email: https://metaradar.io/activate/" + code
                    }
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: 'Activate your email'
                }
            },
            Source: 'info@metaradar.io'
        };

        let ses = new AWS.SES({ apiVersion: '2010-12-01' });
        let ret = await ses.sendEmail(params).promise();

        await ses.sendEmail({
            Destination: {
                ToAddresses: [
                    "amlug@me.com",
                ]
            },
            Message: {
                Body: {
                    Html: {
                        Charset: "UTF-8",
                        Data: "New Signup: " + data.email
                    },
                    Text: {
                        Charset: "UTF-8",
                        Data: "New Signup: " + data.email
                    }
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: 'New User for metaradar.io'
                }
            },
            Source: 'info@metaradar.io'
        }).promise();

        console.log("rettL ", ret);
        return {
            "success": true,
            "status": "verify email"
        }
    }
    else {
        return {
            "success": false,
            "status": "already in the system"
        }
    }

}

