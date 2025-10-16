const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// حافظه Chatran
let memory = {
    greetings: ["سلام", "درود", "سلام خوبی؟", "چه خبر؟", "چطوری؟"],
    farewells: ["خداحافظ", "موفق باشی", "به امید دیدار"]
};

let chatHistory = [];

// تابع نرمال سازی متن
function normalize(text){
    return text.trim().replace(/[0-9]/g,'').toLowerCase();
}

// تابع تولید پاسخ
function getResponse(input){
    const txt = normalize(input);
    chatHistory.push({role:"user", text:input});

    // پاسخ به سلام
    for(const greet of memory.greetings){
        if(txt.includes(greet)) return "سلام! چطور می‌تونم کمکتون کنم؟";
    }

    // پاسخ به خداحافظ
    for(const bye of memory.farewells){
        if(txt.includes(bye)) return "خدانگهدار! امیدوارم زود برگردی.";
    }

    // پاسخ به برنامه نویسی / کد
    if(txt.includes("کد") || txt.includes("برنامه") || txt.includes("js") || txt.includes("python")){
        return "می‌تونم یه نمونه کد برات بنویسم، مثلا JS یا Python. چه چیزی میخوای؟";
    }

    // پاسخ پیشفرض
    return "متاسفانه من قدرت پردازش سوال شما را ندارم.";
}

// API پیام
app.post('/api/message', (req,res)=>{
    const {message} = req.body;
    const response = getResponse(message);
    res.json({response});
});

// API تاریخچه
app.get('/api/history', (req,res)=>{
    res.json(chatHistory);
});

app.listen(3000, ()=>{
    console.log("Chatran server running at http://localhost:3000");
});
