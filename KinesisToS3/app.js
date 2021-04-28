// dependencies
const AWS = require('aws-sdk');

// put the data to S3 client
const s3 = new AWS.S3();
const s3Bucket = "s3-ulsan-pvc";

// put the data to dynamodb
const docClient = new AWS.DynamoDB.DocumentClient();
const table = "PVC_Data";

exports.handler = async (event, context) => {
    // console.log('Received event:', JSON.stringify(event, null, 2));
    if(event.Records.length > 0)
    {
        for (const record of event.Records) {
            // Kinesis data is base64 encoded so decode here
            const payload = Buffer.from(record.kinesis.data, 'base64').toString('ascii');
            // Line 단위로 줄나눔
            const lineData = payload.split('\r\n');
            
            let key = "";
            let sendData = "";
            let preFix = "";
            
            // Comma 를 Parsing하여 데이터 분리
            for(const line of lineData)
            {
                // Comma(,) 를 포함한 Line만 처리
                if(line.search(",") > 0)
                {
                    const data = line.split(',');
                    const timestamp = data[0]; //20210428120000
                    const tagname = data[1];
                    const value = parseFloat(data[2]);
                    const year = data[0].substring(0,4);
                    const month = data[0].substring(4,6);
                    const day = data[0].substring(6,8);
                    const result = await dynamodbDataPut(timestamp, tagname, value);
                    // let preFix = "tag="+tagname+"/yyyy="+year+"/mm="+month+"/";
                    // await s3DataPut(s3Bucket, line, preFix+timestamp+"_test.csv");
                    // console.log(result);
                    
                    //S3 전송 1분단위로 묶을것...
                    let lKey = data[0].substring(0,12) + "_" + tagname;
                    
                    //최초 돌때 key 및 prefix 입력
                    if(key == "") 
                    {
                        key = data[0].substring(0,12) + "_" + tagname;
                        preFix = "tag="+tagname+"/yyyy="+year+"/mm="+month+"/";
                    }
                    
                    if(key != lKey) {
                        await s3DataPut(s3Bucket, sendData, preFix+key +".csv");
                        sendData = "";
                        key = lKey;
                        preFix = "tag="+tagname+"/yyyy="+year+"/mm="+month+"/";
                    }
                    sendData = sendData + line + '\r\n';
                }
            }
            //마지막 전송
            if(sendData != "") await s3DataPut(s3Bucket, sendData, preFix+key +".csv");
        }
    }
    return `Successfully processed records.`;
};

async function s3DataPut(sBucket, sData, sFileName)
{
    try {
      const destparams = {
          Bucket: sBucket,
          Key: sFileName,
          Body: sData,
          ContentType: "csv"
      };
    
      const putResult = await s3.putObject(destparams).promise(); 
      
    } catch (error) {
      console.log(error);
      return;
    } 
}

async function dynamodbDataPut(sTimestamp, sTag, dblValue)
{
    const ttl_timestamp = new Date();
    const ttl = Math.round(ttl_timestamp.valueOf()/1000) + 2592000; //30일 이후
    try {
        const params = {
            TableName:table,
            Item:{
                "tag": sTag,
                "timestamp": sTimestamp,
                "value": dblValue,
                "ttl": ttl
            }
        };

        const returnValue = docClient.put(params).promise();
        return returnValue
      
    } catch (error) {
      console.log(error);
      return;
    } 
}
