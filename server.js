const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static('public'));

// حافظه و تاریخچه Chatran
let memory = {
    greetings: ["سلام","درود","سلام خوبی؟"],
    farewells: ["خداحافظ","موفق باشی","به امید دیدار"],
    default: ["متاسفانه من قدرت پردازش سوال شما را ندارم."]
};

let chatHistory = [];

// تابع نرمال‌سازی متن
function normalize(text){
    return text.trim().replace(/[0-9]/g,'').toLowerCase();
}

// پاسخ‌دهی شبیه GPT
function getResponse(input){
    const txt = normalize(input);
    chatHistory.push({role:"user",text:input});

    // پاسخ به سلام
    for(const greet of memory.greetings){
        if(txt.includes(greet)) return "سلام! چطور می‌تونم کمکتون کنم؟";
    }

    // پاسخ به خداحافظ
    for(const bye of memory.farewells){
        if(txt.includes(bye)) return "خدانگهدار! امیدوارم زود برگردی.";
    }

    // پاسخ به کد و برنامه‌نویسی
    if(txt.includes("کد") || txt.includes("برنامه") || txt.includes("js") || txt.includes("python")){
        return "می‌تونم یه نمونه کد برات بنویسم. میخوای JS باشه یا Python؟";
    }

    // پاسخ پیشرفته شبیه GPT
    if(txt.includes("تحلیل") || txt.includes("فهم")){
        return "من می‌تونم متن شما را تحلیل کنم و مفاهیم اصلی را استخراج کنم.";
    }

    // پاسخ پیشفرض
    return memory.default[Math.floor(Math.random()*memory.default.length)];
}

// API دریافت پیام
app.post('/api/message',(req,res)=>{
    const {message} = req.body;
    const response = getResponse(message);
    res.json({response});
});

// API دریافت تاریخچه
app.get('/api/history',(req,res)=>{
    res.json(chatHistory);
});

app.listen(3000,()=>console.log("Chatran running at http://localhost:3000"));
