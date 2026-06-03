from setuptools import setup, find_packages

setup(
    name="android-game-bot",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "adbutils>=2.8.0",
        "opencv-python>=4.9.0",
        "Pillow>=10.0.0",
        "PyYAML>=6.0",
        "click>=8.1.7",
        "numpy>=1.26.0",
    ],
    entry_points={
        "console_scripts": [
            "agb=android_game_bot.cli:cli",
        ],
    },
    python_requires=">=3.10",
)
