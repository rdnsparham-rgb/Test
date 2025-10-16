# server.py
# نیازمند: pip install fastapi "uvicorn[standard]" transformers accelerate torch
# اگر از CUDA و چندGPU استفاده می‌کنی: pip install bitsandbytes (اختیاری) و تنظیمات device_map="auto"
# اجرا: uvicorn server:app --host 0.0.0.0 --port 8000

from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
import asyncio

app = FastAPI(title="Heavy LM Server")

# مدل پیش‌فرض: مدل سنگین اما عملی‌تر نسبت به 20B
MODEL_NAME = "EleutherAI/gpt-j-6B"  # می‌تونی این را به مدل سنگین‌تر تغییر بدی (مثال: "bigscience/bloom-7b1", "facebook/opt-6.7b", یا مدل‌های 20B+)

class GenRequest(BaseModel):
    prompt: str
    max_length: Optional[int] = 256
    temperature: Optional[float] = 0.8
    top_p: Optional[float] = 0.9
    do_sample: Optional[bool] = True

# بارگذاری مدل و توکنایزر (تلاش برای استفاده از GPU اگر موجود باشد)
print("درحال بارگذاری توکنایزر و مدل... صبور باشید (ممکن است چند دقیقه طول بکشد).")
device = "cuda" if torch.cuda.is_available() else "cpu"
print("تجهیز: ", device)

# اگر سیستمت چند GPU داره و از accelerate پشتیبانی می‌کنه، می‌تونی device_map="auto" استفاده کنی.
# برای محیط CPU سنگین، ممکنه زمان و حافظه بسیار زیادی لازم باشد.
try:
    # تلاش اولیه: از device_map برای توزیع خودکار روی GPUها استفاده کن
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        device_map="auto",            # اگر فقط CPU ست شده باشه، ممکنه خطا بده؛ در آن صورت fallback به زیر
        torch_dtype=torch.float16,    # برای کاهش حافظه؛ اگر خطا شد، از float32 استفاده کن
        low_cpu_mem_usage=True        # تلاش برای استفاده کم از رم در بارگذاری
    )
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    # مدل در device_map="auto" خودش را روی GPUها می‌پخش کند
    print("مدل با device_map=auto بارگذاری شد.")
except Exception as e:
    print("خطا در بارگذاری با device_map=auto یا fp16:", e)
    print("سعی می‌کنم مدل را به صورت ساده روی CPU یا single-GPU بارگذاری کنم.")
    # fallback ساده
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
    model.to(device)
    print("مدل fallback بارگذاری شد روی:", device)

# اگر توکنایزر padding ندارد، این تنظیم مفید است:
if tokenizer.pad_token_id is None:
    tokenizer.pad_token = tokenizer.eos_token

@app.get("/")
async def root():
    return {"status": "ok", "model": MODEL_NAME, "device": device}

@app.post("/generate")
async def generate(req: GenRequest):
    prompt = req.prompt
    # ایمن‌سازی ساده: محدود کردن حداکثر طول ورودی و خروجی
    if len(prompt) > 5000:
        return {"error": "prompt too long"}
    max_length = min(req.max_length, 2048)  # جلوگیری از طول خیلی زیاد
    # آماده‌سازی ورودی
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    # تنظیمات تولید
    gen_kwargs = dict(
        input_ids=inputs["input_ids"],
        attention_mask=inputs.get("attention_mask", None),
        max_length=max_length,
        do_sample=req.do_sample,
        temperature=req.temperature,
        top_p=req.top_p,
        num_return_sequences=1,
    )

    # اجرای تولید در ThreadPool یا loop تا نپره
    loop = asyncio.get_event_loop()
    try:
        outputs = await loop.run_in_executor(None, lambda: model.generate(**gen_kwargs))
    except Exception as e:
        # در صورت خطا، تلاش روی CPU
        try:
            model.to("cpu")
            inputs = tokenizer(prompt, return_tensors="pt").to("cpu")
            outputs = model.generate(input_ids=inputs["input_ids"], max_length=max_length, do_sample=req.do_sample,
                                     temperature=req.temperature, top_p=req.top_p, num_return_sequences=1)
        except Exception as e2:
            return {"error": f"generation failed: {e} | fallback failed: {e2}"}

    text = tokenizer.decode(outputs[0], skip_special_tokens=True)
    # اگر مدل متن را از prompt ادامه داده، می‌توان prompt را جدا کرد
    reply = text[len(prompt):].strip() if text.startswith(prompt) else text
    return {"generated_text": reply, "full_text": text}

# توجه: برای مدل‌های خیلی خیلی خیلی سنگین (مثلاً 20B+) باید از توزیع و inference server (مثل Hugging Face Inference Endpoint،
# or Nvidia Triton یا distributed deepspeed / accelerate) استفاده کنید. این سرور نمونه برای شروع و تست محلی مناسب است.
