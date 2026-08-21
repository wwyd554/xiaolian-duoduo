FROM public.ecr.aws/lambda/python:3.13

# popplerインストール（PDF→画像変換に必要）
RUN dnf install -y poppler-utils && dnf clean all

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY index.py .

CMD ["index.lambda_handler"]
