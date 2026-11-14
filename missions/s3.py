# missions/s3.py
import boto3


class S3Manager:
    """
    Gerenciador centralizado de conexão S3.

    Isolado em módulo próprio para ser reutilizado por qualquer adaptador
    de missão sem duplicar a lógica de autenticação/configuração.
    """

    def __init__(self, bucket_name: str = "amnh-citsci-private",
                 region: str = "us-west-2"):
        s3 = boto3.resource("s3", region_name=region)
        self.bucket = s3.Bucket(bucket_name)
        self.bucket_name = bucket_name
        self.region = region
